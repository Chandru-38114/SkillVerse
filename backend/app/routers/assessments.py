import datetime as dt
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db
from ..data.questions import get_questions_for_skill, QUESTION_BANK
from ..services.question_generator import (
    GenerationError, canonical_level, canonical_skill, generate_assessment, sanitize,
)
from ..services.code_grader import grade_coding_answer
from ..utils.timezone import utc_now, enforce_utc_iso
from .users import get_or_create_skill

router = APIRouter(prefix="/assessments", tags=["assessments"])
logger = logging.getLogger(__name__)

ARENA_DURATION_MINUTES = int(os.getenv("ARENA_DURATION_MINUTES", "45"))
ARENA_GRACE_SECONDS = 120


def _aware(value: dt.datetime) -> dt.datetime:
    """SQLite drops tzinfo on round-trip even for DateTime(timezone=True) columns;
    treat a naive value as UTC so arithmetic against utc_now() never raises."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value


@router.post("/start")
async def start_assessment(
    payload: schemas.AssessmentStart,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Generate a fresh assessment with Gemini and store it (with answers) server-side.
    Returns the attempt id and the questions WITHOUT answers. Falls back to the
    hand-written bank if AI generation is unavailable for a skill that has one."""
    skill = canonical_skill(payload.skill_name)
    if not skill:
        raise HTTPException(status_code=400, detail="Skill name is required")
    level = canonical_level(payload.level)

    now = utc_now()
    active = (
        db.query(models.AssessmentSession)
        .filter(
            models.AssessmentSession.user_id == current_user.id,
            models.AssessmentSession.skill_name == skill,
            models.AssessmentSession.submitted_at.is_(None),
            models.AssessmentSession.expires_at > now,
        )
        .order_by(models.AssessmentSession.created_at.desc())
        .first()
    )
    if active:
        active_expires = _aware(active.expires_at)
        seconds_remaining = max(0, int((active_expires - now).total_seconds()))
        return {
            "attempt_id": active.id, "skill_name": active.skill_name, "source": active.source,
            "level": level, "questions": sanitize(active.questions), "resumed": True,
            "expires_at": enforce_utc_iso(active_expires), "seconds_remaining": seconds_remaining,
        }

    source = "ai"
    try:
        questions = await run_in_threadpool(generate_assessment, skill, level)
    except GenerationError as err:
        logger.warning("[arena] AI generation unavailable for %s: %s", skill, err)
        if skill.lower() not in QUESTION_BANK:
            raise HTTPException(
                status_code=503,
                detail="The AI question generator is busy right now. Please try again in a minute.",
            )
        questions, source = get_questions_for_skill(skill), "bank"

    expires_at = now + dt.timedelta(minutes=ARENA_DURATION_MINUTES)
    session = models.AssessmentSession(
        id=str(uuid.uuid4()), user_id=current_user.id, skill_name=skill,
        source=source, questions=questions, expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    return {
        "attempt_id": session.id, "skill_name": skill, "source": source,
        "level": level, "questions": sanitize(questions), "resumed": False,
        "expires_at": enforce_utc_iso(expires_at),
        "seconds_remaining": ARENA_DURATION_MINUTES * 60,
    }


@router.get("/latest", response_model=schemas.AssessmentAttemptOut)
def get_latest_assessment(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Returns the most recent assessment attempt for the current user."""
    attempt = db.query(models.AssessmentAttempt)\
        .filter(models.AssessmentAttempt.user_id == current_user.id)\
        .order_by(models.AssessmentAttempt.created_at.desc())\
        .first()
    if not attempt:
        raise HTTPException(status_code=404, detail="No assessment attempts found")
    return attempt


@router.get("/questions/{skill_name}")
def get_assessment_questions(skill_name: str):
    """Returns questions WITHOUT the answer key."""
    questions = get_questions_for_skill(skill_name)
    return [
        {"id": q["id"], "topic": q["topic"], "type": q["type"],
         "question": q["question"], "options": q["options"]}
        for q in questions
    ]


def level_for_score(score: float) -> str:
    if score < 40:
        return "Beginner"
    if score < 70:
        return "Intermediate"
    return "Advanced"


def badge_for_score(score: float):
    if score >= 90:
        return "Expert"
    if score >= 75:
        return "Gold"
    if score >= 60:
        return "Silver"
    if score >= 40:
        return "Bronze"
    return None


def study_plan_for_topics(weak_topics: list[str]) -> list[str]:
    if not weak_topics:
        return ["You're solid across the board — consider teaching this skill to others."]
    return [f"Day {i+1}: Focus on {topic}" for i, topic in enumerate(weak_topics)]


@router.post("/submit", response_model=schemas.AssessmentResult)
def submit_assessment(
    payload: schemas.AssessmentSubmit,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    skill_name = payload.skill_name
    terminated = payload.terminated
    violations = max(0, payload.violations)
    if payload.attempt_id:
        session = db.query(models.AssessmentSession).filter(models.AssessmentSession.id == payload.attempt_id).first()
        if not session or session.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Assessment attempt not found")
        if session.submitted_at is not None:
            raise HTTPException(status_code=409, detail="This assessment has already been submitted")
        now = utc_now()
        if session.expires_at is not None and now > _aware(session.expires_at) + dt.timedelta(seconds=ARENA_GRACE_SECONDS):
            terminated = True
        session.submitted_at = now  # committed together with the results below
        session.violations = violations
        session.terminated = terminated
        questions = session.questions
        skill_name = session.skill_name
    else:
        # Legacy path: static question bank
        questions = get_questions_for_skill(payload.skill_name)
    if not questions:
        raise HTTPException(status_code=404, detail="No questions for this skill")

    submitted = {a.question_id: a.answer for a in payload.answers}

    per_topic_earned = {}
    per_topic_total = {}
    total_marks = 0.0
    earned_marks = 0.0
    coding_feedback = []

    for q in questions:
        topic = q["topic"]
        marks = q.get("marks", 1)
        total_marks += marks
        per_topic_total[topic] = per_topic_total.get(topic, 0) + marks

        if q.get("type") == "coding":
            answer = submitted.get(q["id"], "")
            result = grade_coding_answer(answer, q["function_name"], q["tests"])
            earned = marks * result["fraction"]
            coding_feedback.append(f"{q.get('title', q['topic'])}: {result['detail']}")
        else:
            earned = marks if submitted.get(q["id"]) == q["answer"] else 0

        earned_marks += earned
        per_topic_earned[topic] = per_topic_earned.get(topic, 0) + earned

    score = round((earned_marks / total_marks) * 100, 1) if total_marks else 0.0
    level = level_for_score(score)
    badge = badge_for_score(score)

    # Weak topics = topics where the user earned less than 60% of that topic's marks
    weak_topics = [
        topic for topic in per_topic_total
        if (per_topic_earned.get(topic, 0) / per_topic_total[topic]) < 0.6
    ]
    study_plan = coding_feedback + study_plan_for_topics(weak_topics)

    # Persist attempt + update the user's skill record
    attempt = models.AssessmentAttempt(
        user_id=current_user.id,
        skill_id=get_or_create_skill(db, skill_name).id,
        score=score,
        weak_topics=",".join(weak_topics),
    )
    db.add(attempt)

    skill = get_or_create_skill(db, skill_name)
    user_skill = (
        db.query(models.UserSkill)
        .filter(models.UserSkill.user_id == current_user.id, models.UserSkill.skill_id == skill.id)
        .first()
    )
    if not user_skill:
        user_skill = models.UserSkill(user_id=current_user.id, skill_id=skill.id, role=payload.role)
        db.add(user_skill)

    had_badge_before = bool(user_skill.badge) if hasattr(user_skill, 'badge') else False

    user_skill.latest_score = score
    user_skill.level = level
    user_skill.badge = badge
    user_skill.role = payload.role

    # Award points for completing a certification ONLY if they did not already have a badge for this skill
    if badge and not had_badge_before:
        current_user.points += 50

    db.commit()
    create_notification(db, current_user.id, "assessment", "Assessment Completed", f"You scored {score}% on {skill.name}", attempt.id, "assessment")
    if badge:
        create_notification(db, current_user.id, "assessment", "Badge Earned", f"You earned a {badge} badge in {skill.name}!", attempt.id, "assessment")

    return schemas.AssessmentResult(
        score=score, level=level, badge=badge,
        weak_topics=weak_topics, study_plan=study_plan,
        violations=violations, terminated=terminated,
    )
