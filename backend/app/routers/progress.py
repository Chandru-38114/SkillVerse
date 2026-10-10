import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime as dt
from ..utils.timezone import utc_now

from .. import models, schemas, auth
from ..database import get_db
from ..services.summarization import generate_session_summary
from ..services.question_generator import GenerationError, SKILL_TOPICS, canonical_skill, generate_session_quiz, sanitize
from ..services.learning_plan import build_next_session_plan
from ..utils.progress_utils import compute_skill_stage
from .assessments import level_for_score

router = APIRouter(prefix="/progress", tags=["progress"])
logger = logging.getLogger(__name__)


def _split_topics(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]


def _dedupe(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _has_content(text: Optional[str]) -> bool:
    return bool(text and text.strip() and text.strip() != "[]")


MIN_SESSION_SUMMARY_CHARS = 120


class SessionQuizAnswer(BaseModel):
    question_id: str
    answer: str


class SessionQuizSubmit(BaseModel):
    attempt_id: str
    answers: List[SessionQuizAnswer]


@router.get("/my", response_model=List[schemas.UserSkillProgressOut])
def get_my_progress(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_skills = db.query(models.UserSkill).filter(models.UserSkill.user_id == current_user.id).all()
    
    out = []
    for us in user_skills:
        assessments = db.query(models.AssessmentAttempt).filter(
            models.AssessmentAttempt.user_id == current_user.id,
            models.AssessmentAttempt.skill_id == us.skill_id
        ).count()
        
        history = db.query(models.SessionProgress).filter(
            models.SessionProgress.user_id == current_user.id,
            models.SessionProgress.skill_id == us.skill_id,
            models.SessionProgress.duration_minutes > 0
        ).order_by(models.SessionProgress.created_at.desc()).all()
        
        history_items = []
        for h in history:
            history_items.append(schemas.SessionProgressOut(
                id=h.id,
                session_id=h.session_id,
                user_id=h.user_id,
                skill_id=h.skill_id,
                topics_discussed=h.topics_discussed or "",
                topics_completed=h.topics_completed or "",
                learning_notes=h.learning_notes or "",
                duration_minutes=h.duration_minutes or 0,
                level_before=h.level_before,
                level_after=h.level_after,
                progress_percentage_before=h.progress_percentage_before or 0,
                progress_percentage_after=h.progress_percentage_after or 0,
                created_at=h.created_at,
                updated_at=h.updated_at
            ))
        
        stage, what_happened, next_milestone = compute_skill_stage(assessments, us.sessions_completed, us.badge, us.level, us.total_learning_minutes)
        
        us_out = schemas.UserSkillProgressOut(
            id=us.id,
            skill_id=us.skill_id,
            skill_name=us.skill.name,
            role=us.role,
            latest_score=us.latest_score,
            level=us.level,
            badge=us.badge,
            progress_percentage=us.progress_percentage,
            sessions_completed=us.sessions_completed,
            total_learning_minutes=us.total_learning_minutes,
            assessment_count=assessments,
            stage=stage,
            what_happened=what_happened,
            next_milestone=next_milestone,
            history=history_items
        )
        out.append(us_out)
        
    return out

@router.get("/skill/{skill_name}", response_model=schemas.UserSkillProgressOut)
def get_skill_progress(skill_name: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    skill = db.query(models.Skill).filter(models.Skill.name == skill_name).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
        
    user_skill = db.query(models.UserSkill).filter(
        models.UserSkill.user_id == current_user.id,
        models.UserSkill.skill_id == skill.id
    ).order_by(models.UserSkill.role.asc()).first()
    
    if not user_skill:
        raise HTTPException(status_code=404, detail="User skill not found")
        
    assessments = db.query(models.AssessmentAttempt).filter(
        models.AssessmentAttempt.user_id == current_user.id,
        models.AssessmentAttempt.skill_id == skill.id
    ).count()
    
    history = db.query(models.SessionProgress).filter(
        models.SessionProgress.user_id == current_user.id,
        models.SessionProgress.skill_id == skill.id,
        models.SessionProgress.duration_minutes > 0
    ).order_by(models.SessionProgress.created_at.desc()).all()
    
    stage, what_happened, next_milestone = compute_skill_stage(assessments, user_skill.sessions_completed, user_skill.badge, user_skill.level, user_skill.total_learning_minutes)
    
    return schemas.UserSkillProgressOut(
        id=user_skill.id,
        skill_id=user_skill.skill_id,
        skill_name=user_skill.skill.name,
        role=user_skill.role,
        latest_score=user_skill.latest_score,
        level=user_skill.level,
        badge=user_skill.badge,
        progress_percentage=user_skill.progress_percentage,
        sessions_completed=user_skill.sessions_completed,
        total_learning_minutes=user_skill.total_learning_minutes,
        assessment_count=assessments,
        stage=stage,
        what_happened=what_happened,
        next_milestone=next_milestone,
        history=[schemas.SessionProgressOut(
            id=h.id, session_id=h.session_id, user_id=h.user_id, skill_id=h.skill_id,
            topics_discussed=h.topics_discussed or "", topics_completed=h.topics_completed or "",
            learning_notes=h.learning_notes or "", semantic_summary=h.semantic_summary, duration_minutes=h.duration_minutes or 0,
            level_before=h.level_before, level_after=h.level_after,
            progress_percentage_before=h.progress_percentage_before or 0,
            progress_percentage_after=h.progress_percentage_after or 0,
            created_at=h.created_at, updated_at=h.updated_at
        ) for h in history]
    )

@router.get("/history", response_model=List[schemas.SessionProgressOut])
def get_history(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    history = db.query(models.SessionProgress).filter(
        models.SessionProgress.user_id == current_user.id,
        models.SessionProgress.duration_minutes > 0
    ).order_by(models.SessionProgress.created_at.desc()).all()
    
    result = []
    for h in history:
        result.append(schemas.SessionProgressOut(
            id=h.id,
            session_id=h.session_id,
            user_id=h.user_id,
            skill_id=h.skill_id,
            topics_discussed=h.topics_discussed or "",
            topics_completed=h.topics_completed or "",
            learning_notes=h.learning_notes or "",
            semantic_summary=h.semantic_summary,
            duration_minutes=h.duration_minutes or 0,
            level_before=h.level_before,
            level_after=h.level_after,
            progress_percentage_before=h.progress_percentage_before or 0,
            progress_percentage_after=h.progress_percentage_after or 0,
            created_at=h.created_at,
            updated_at=h.updated_at
        ))
    return result

@router.get("/session/{session_id}", response_model=schemas.SessionProgressOut)
def get_session_progress(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    sess = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.id not in [sess.tutor_id, sess.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    prog = db.query(models.SessionProgress).filter(
        models.SessionProgress.session_id == session_id,
        models.SessionProgress.user_id == current_user.id
    ).first()
    
    if not prog:
        # Return an empty dummy to allow editing before saving
        dummy_skill = db.query(models.Skill).filter(models.Skill.name == sess.skill).first()
        return schemas.SessionProgressOut(
            id=0,
            session_id=session_id,
            user_id=current_user.id,
            skill_id=dummy_skill.id if dummy_skill else 0,
            topics_discussed="",
            topics_completed="",
            learning_notes="",
            semantic_summary=None,
            duration_minutes=0,
            progress_percentage_before=0,
            progress_percentage_after=0,
            created_at=utc_now(),
            updated_at=utc_now()
        )
        
    return schemas.SessionProgressOut(
        id=prog.id,
        session_id=prog.session_id,
        user_id=prog.user_id,
        skill_id=prog.skill_id,
        topics_discussed=prog.topics_discussed or "",
        topics_completed=prog.topics_completed or "",
        learning_notes=prog.learning_notes or "",
        semantic_summary=prog.semantic_summary,
        duration_minutes=prog.duration_minutes or 0,
        level_before=prog.level_before,
        level_after=prog.level_after,
        progress_percentage_before=prog.progress_percentage_before or 0,
        progress_percentage_after=prog.progress_percentage_after or 0,
        created_at=prog.created_at,
        updated_at=prog.updated_at
    )


@router.put("/session/{session_id}")
def update_session_notes(session_id: int, payload: schemas.SessionProgressUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    sess = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.id not in [sess.tutor_id, sess.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_skill = db.query(models.Skill).filter(models.Skill.name == sess.skill).first()
    if not db_skill:
        raise HTTPException(status_code=400, detail="Skill not found")

    prog = db.query(models.SessionProgress).filter(
        models.SessionProgress.session_id == session_id,
        models.SessionProgress.user_id == current_user.id
    ).first()
    
    if not prog:
        prog = models.SessionProgress(
            session_id=session_id,
            user_id=current_user.id,
            skill_id=db_skill.id
        )
        db.add(prog)
    
    if payload.topics_discussed is not None:
        prog.topics_discussed = payload.topics_discussed
    if payload.topics_completed is not None:
        prog.topics_completed = payload.topics_completed
    if payload.learning_notes is not None:
        prog.learning_notes = payload.learning_notes
        
    db.commit()
    return {"status": "ok"}


@router.post("/session/{session_id}/complete")
def complete_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    sess = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.id not in [sess.tutor_id, sess.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    prog = db.query(models.SessionProgress).filter(
        models.SessionProgress.session_id == session_id,
        models.SessionProgress.user_id == current_user.id
    ).first()

    # Prevent double completion by checking if progress_percentage_after > 0 
    # OR if duration_minutes > 0 (in case progress is 0)
    if prog and prog.duration_minutes > 0:
        raise HTTPException(status_code=400, detail="You have already completed this session's progress")

    try:
        st = dt.datetime.strptime(sess.start_time, "%H:%M")
        en = dt.datetime.strptime(sess.end_time, "%H:%M")
        duration = int((en - st).total_seconds() / 60)
        if duration < 0:
            duration += 24 * 60
        if duration == 0:
            duration = 60 # fallback
    except Exception:
        duration = 60

    db_skill = db.query(models.Skill).filter(models.Skill.name == sess.skill).first()
    if not db_skill:
        raise HTTPException(status_code=400, detail="Skill not found")
        
    user_skill = db.query(models.UserSkill).filter(
        models.UserSkill.user_id == current_user.id,
        models.UserSkill.skill_id == db_skill.id
    ).first()

    if not user_skill:
        role = "teaching" if current_user.id == sess.tutor_id else "learning"
        user_skill = models.UserSkill(
            user_id=current_user.id,
            skill_id=db_skill.id,
            role=role,
            level="Unassessed"
        )
        db.add(user_skill)
        db.commit()
        db.refresh(user_skill)

    if not prog:
        prog = models.SessionProgress(
            session_id=session_id,
            user_id=current_user.id,
            skill_id=db_skill.id
        )
        db.add(prog)
        
    prog.level_before = user_skill.level
    prog.progress_percentage_before = user_skill.progress_percentage
    prog.duration_minutes = duration
    
    # We no longer invent progress percentage.
    user_skill.sessions_completed += 1
    user_skill.total_learning_minutes += duration
    
    prog.level_after = user_skill.level
    prog.progress_percentage_after = user_skill.progress_percentage
    
    # We update session status to completed if it isn't already
    if sess.status != "completed":
        sess.status = "completed"
        
    # Attempt LLM Summarization
    if not prog.semantic_summary:
        try:
            messages = db.query(models.Message).filter(models.Message.request_id == sess.request_id).order_by(models.Message.created_at).all()
            chat_history = "\n".join([f"{msg.sender_id}: {msg.content}" for msg in messages])
            
            wb = db.query(models.WhiteboardState).filter(models.WhiteboardState.session_id == session_id).first()
            whiteboard_state = wb.state if wb else ""
            
            comp = db.query(models.CompilerState).filter(models.CompilerState.session_id == session_id).first()
            compiler_code = comp.code if comp else ""
            
            summary = generate_session_summary(chat_history, whiteboard_state, compiler_code)
            if summary and not summary.startswith("Error"):
                prog.semantic_summary = summary
                
                # Also save the semantic summary for the other participant if their progress record exists
                other_user_id = sess.learner_id if current_user.id == sess.tutor_id else sess.tutor_id
                other_prog = db.query(models.SessionProgress).filter(
                    models.SessionProgress.session_id == session_id,
                    models.SessionProgress.user_id == other_user_id
                ).first()
                if other_prog:
                    other_prog.semantic_summary = summary
        except Exception as e:
            logger.warning("[progress] session summary generation failed for session %s: %s", session_id, e)

    db.commit()

    return {"status": "ok", "sessions_completed": user_skill.sessions_completed}


@router.post("/session/{session_id}/quiz/start")
async def start_session_quiz(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Formative-only post-session knowledge check. Never affects UserSkill, badges,
    points or marketplace ranking - it writes only to this user's SessionProgress row."""
    sess = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.id not in [sess.tutor_id, sess.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if sess.status != "completed":
        raise HTTPException(status_code=400, detail="This session has not been completed yet")

    prog = db.query(models.SessionProgress).filter(
        models.SessionProgress.session_id == session_id,
        models.SessionProgress.user_id == current_user.id,
    ).first()
    if not prog or not prog.semantic_summary:
        raise HTTPException(status_code=409, detail="The session summary is not ready yet")

    active = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.user_id == current_user.id,
        models.AssessmentSession.session_id == session_id,
        models.AssessmentSession.submitted_at.is_(None),
    ).order_by(models.AssessmentSession.created_at.desc()).first()
    if active:
        return {"attempt_id": active.id, "questions": sanitize(active.questions), "resumed": True}

    messages = db.query(models.Message).filter(models.Message.request_id == sess.request_id).all()
    chat_history = "\n".join(msg.content for msg in messages)
    wb = db.query(models.WhiteboardState).filter(models.WhiteboardState.session_id == session_id).first()
    comp = db.query(models.CompilerState).filter(models.CompilerState.session_id == session_id).first()
    has_source = (
        _has_content(chat_history)
        or _has_content(wb.state if wb else None)
        or _has_content(comp.code if comp else None)
    )

    topics = _dedupe(
        _split_topics(prog.topics_discussed)
        + _split_topics(prog.topics_completed)
        + SKILL_TOPICS.get(canonical_skill(sess.skill), [])
    )

    if len(prog.semantic_summary.strip()) < MIN_SESSION_SUMMARY_CHARS or not has_source or not topics:
        raise HTTPException(
            status_code=409,
            detail="There wasn't enough recorded in this session to build a knowledge check.",
        )

    try:
        questions = await run_in_threadpool(
            generate_session_quiz, sess.skill, prog.level_before or "intermediate", prog.semantic_summary, topics,
        )
    except GenerationError as err:
        logger.warning("[arena] session quiz unavailable for session %s: %s", session_id, err)
        raise HTTPException(
            status_code=503,
            detail="The AI quiz generator is busy right now. Please try again in a minute.",
        )

    attempt = models.AssessmentSession(
        id=str(uuid.uuid4()), user_id=current_user.id, skill_name=sess.skill,
        source="session", session_id=session_id, questions=questions,
    )
    db.add(attempt)
    db.commit()
    return {"attempt_id": attempt.id, "questions": sanitize(questions), "resumed": False}


@router.post("/session/{session_id}/quiz/submit")
def submit_session_quiz(session_id: int, payload: SessionQuizSubmit, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    attempt = db.query(models.AssessmentSession).filter(models.AssessmentSession.id == payload.attempt_id).first()
    if not attempt or attempt.user_id != current_user.id or attempt.session_id != session_id:
        raise HTTPException(status_code=404, detail="Session quiz attempt not found")
    if attempt.submitted_at is not None:
        raise HTTPException(status_code=409, detail="This session quiz has already been submitted")

    sess = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    prog = db.query(models.SessionProgress).filter(
        models.SessionProgress.session_id == session_id,
        models.SessionProgress.user_id == current_user.id,
    ).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Session progress not found")

    submitted = {a.question_id: a.answer for a in payload.answers}

    total = 0
    correct = 0
    missed_topics = []
    for q in attempt.questions:
        total += 1
        if submitted.get(q["id"]) == q["answer"]:
            correct += 1
        elif q["topic"] not in missed_topics:
            missed_topics.append(q["topic"])

    score = round((correct / total) * 100, 1) if total else 0.0
    attempt.submitted_at = utc_now()

    weak_topics = []
    attempt_row = db.query(models.AssessmentAttempt).filter(
        models.AssessmentAttempt.user_id == current_user.id,
        models.AssessmentAttempt.skill_id == prog.skill_id,
    ).order_by(models.AssessmentAttempt.created_at.desc()).first()
    if attempt_row and attempt_row.weak_topics:
        weak_topics = _split_topics(attempt_row.weak_topics)

    next_session_plan = build_next_session_plan(
        sess.skill, prog.semantic_summary or "", score, missed_topics, weak_topics,
    )

    prog.progress_percentage_after = int(score)
    prog.level_after = level_for_score(score)
    prog.next_session_plan = "\n".join(next_session_plan)

    db.commit()
    return {"score": score, "missed_topics": missed_topics, "next_session_plan": next_session_plan}
