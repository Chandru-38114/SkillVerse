from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime as dt

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/progress", tags=["progress"])

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
            models.SessionProgress.progress_percentage_after > 0
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
        models.SessionProgress.progress_percentage_after > 0
    ).order_by(models.SessionProgress.created_at.desc()).all()
    
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
        history=[schemas.SessionProgressOut(
            id=h.id, session_id=h.session_id, user_id=h.user_id, skill_id=h.skill_id,
            topics_discussed=h.topics_discussed or "", topics_completed=h.topics_completed or "",
            learning_notes=h.learning_notes or "", duration_minutes=h.duration_minutes or 0,
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
        models.SessionProgress.progress_percentage_after > 0
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
            duration_minutes=0,
            progress_percentage_before=0,
            progress_percentage_after=0,
            created_at=dt.datetime.utcnow(),
            updated_at=dt.datetime.utcnow()
        )
        
    return schemas.SessionProgressOut(
        id=prog.id,
        session_id=prog.session_id,
        user_id=prog.user_id,
        skill_id=prog.skill_id,
        topics_discussed=prog.topics_discussed or "",
        topics_completed=prog.topics_completed or "",
        learning_notes=prog.learning_notes or "",
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
    
    if user_skill.role == "learning":
        new_prog = min(100, user_skill.progress_percentage + 10)
    else:
        new_prog = min(100, user_skill.progress_percentage + 5)
        
    user_skill.progress_percentage = new_prog
    user_skill.sessions_completed += 1
    user_skill.total_learning_minutes += duration
    
    prog.level_after = user_skill.level
    prog.progress_percentage_after = new_prog
    
    # We update session status to completed if it isn't already
    if sess.status != "completed":
        sess.status = "completed"
        
    db.commit()
    
    return {"status": "ok", "progress_percentage": new_prog}
