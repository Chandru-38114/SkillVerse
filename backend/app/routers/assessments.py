"""
Skill Arena (the proctored assessment).

- POST /assessments/start    make (or resume) an attempt; questions WITHOUT answers
- GET  /assessments/latest   my latest attempt
- POST /assessments/submit   score on the server, update level/badge/role/course

Answer keys never leave the server (CLAUDE.md rule).
"""
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
    GenerationError, canonical_level, generate_assessment, sanitize,
)
from ..services.code_grader import grade_coding_answer
from ..services.learning_plan import build_study_plan
from ..utils.timezone import as_utc, enforce_utc_iso, utc_now
from ..utils.levels import score_to_level
from ..utils.progress_utils import progress_for
from ..services.course_rules import (
    FINAL_PASS_SCORE, MAX_COURSES, SESSIONS_FOR_FINAL, TEACH_MIN_SCORE,
    clean_course_name, course_count, ensure_can_add_course, find_course, user_course,
)
from ..services.demand_service import notify_requesters_on_teacher_level_qualified
from .users import get_or_create_skill

router = APIRouter(prefix="/assessments", tags=["assessments"])
logger = logging.getLogger(__name__)

ARENA_DURATION_MINUTES = int(os.getenv("ARENA_DURATION_MINUTES", "45"))
ARENA_GRACE_SECONDS = 120


@router.post("/start")
async def start_assessment(
    payload: schemas.AssessmentStart,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Generate a fresh assessment with Gemini and store it (with answers) server-side.
    Returns the attempt id and the questions WITHOUT answers. Falls back to the
    hand-written bank if AI generation is unavailable for a skill that has one."""
    skill = clean_course_name(payload.skill_name)  # 400 for an unusable name
    level = canonical_level(payload.level)

    # Course rules before spending an AI call: a NEW course needs a free slot
    # (max 4 courses). Retakes of an existing course are always allowed.
    existing_skill = find_course(db, skill)
    existing_row = user_course(db, current_user.id, existing_skill.id) if existing_skill else None
    if existing_row is None:
        ensure_can_add_course(db, current_user.id)

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
        active_expires = as_utc(active.expires_at)
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


# ---------------------------------------------------------------------------
# Scoring rules
# ---------------------------------------------------------------------------
BADGE_MIN_SCORE = 40        # Bronze starts here
FIRST_BADGE_POINTS = 50     # once per course, ever
WEAK_TOPIC_BELOW = 0.6      # a topic is "weak" under 60% of its marks


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
    if score >= BADGE_MIN_SCORE:
        return "Bronze"
    return None


def study_plan_for_topics(weak_topics: list[str]) -> list[str]:
    """Simple plan used when the AI study plan isn't available."""
    if not weak_topics:
        return ["You're solid across the board — consider teaching this skill to others."]
    return [f"Day {i+1}: Focus on {topic}" for i, topic in enumerate(weak_topics)]


def _score_answers(questions: list, submitted: dict):
    """Mark every question against the SERVER's stored answers.
    Returns (score %, weak topics, mastery % per topic, coding feedback lines)."""
    per_topic_earned, per_topic_total = {}, {}
    total_marks = earned_marks = 0.0
    coding_feedback = []

    for q in questions:
        topic = q["topic"]
        marks = q.get("marks", 1)
        total_marks += marks
        per_topic_total[topic] = per_topic_total.get(topic, 0) + marks

        if q.get("type") == "coding":
            result = grade_coding_answer(submitted.get(q["id"], ""), q["function_name"], q["tests"])
            earned = marks * result["fraction"]
            coding_feedback.append(f"{q.get('title', q['topic'])}: {result['detail']}")
        else:
            earned = marks if submitted.get(q["id"]) == q["answer"] else 0

        earned_marks += earned
        per_topic_earned[topic] = per_topic_earned.get(topic, 0) + earned

    score = round((earned_marks / total_marks) * 100, 1) if total_marks else 0.0
    weak_topics = [
        topic for topic in per_topic_total
        if (per_topic_earned.get(topic, 0) / per_topic_total[topic]) < WEAK_TOPIC_BELOW
    ]
    topic_mastery = {
        topic: round((per_topic_earned.get(topic, 0) / per_topic_total[topic]) * 100, 1)
        for topic in per_topic_total
    }
    return score, weak_topics, topic_mastery, coding_feedback


def _record_weekly_attempt(db: Session, user_id: int, skill_id: int, score: float) -> bool:
    """Save the attempt in the weekly history. Only the FIRST attempt of each
    week (Monday-Sunday) counts towards the report card. Returns whether it counted."""
    now = utc_now()
    week_start = now.date() - dt.timedelta(days=now.date().weekday())  # Monday
    already_counted = (
        db.query(models.WeeklyAttempt)
        .filter(
            models.WeeklyAttempt.user_id == user_id,
            models.WeeklyAttempt.skill_id == skill_id,
            models.WeeklyAttempt.week_start == week_start,
            models.WeeklyAttempt.counted == True,  # noqa: E712 (SQL comparison)
        )
        .first()
    ) is not None
    db.add(models.WeeklyAttempt(
        user_id=user_id, skill_id=skill_id, score=score, level_num=score_to_level(score),
        taken_at=now, week_start=week_start, counted=not already_counted,
    ))
    return not already_counted


def _apply_role_rules(user_skill, wants_to_teach: bool, can_promote: bool, score: float, course_name: str):
    """The SERVER decides the role (the client only says which goal it chose):
    - a teacher stays a teacher (a teacher can never become a learner of the
      same course);
    - a learner becomes a teacher only with the "teach" goal and a score of
      at least TEACH_MIN_SCORE, and never from a terminated attempt.
    `user_skill` is an existing row, or None for a new course (then a role is
    chosen for the new row). Returns (role for a new row or None, message or None)."""
    promote = wants_to_teach and can_promote and score >= TEACH_MIN_SCORE
    # Why a "teach" attempt didn't promote: the score, or the attempt was ended
    # early (rule violations / time over) — a high score alone must not read
    # as "you need 60%".
    if not can_promote and score >= TEACH_MIN_SCORE:
        reason = (f"This attempt ended early (rule violations or time over), so it can't make you "
                  f"a tutor for {course_name}. Take the Skill Arena again without violations.")
    else:
        reason = f"You need {TEACH_MIN_SCORE}% to teach {course_name}."
    if user_skill is None:
        if promote:
            return "teaching", f"You are now a verified tutor for {course_name}."
        if wants_to_teach:
            return "learning", f"{reason} We added it to your learning courses — learn, then try again."
        return "learning", None
    if user_skill.role == "learning" and wants_to_teach:
        if promote:
            user_skill.role = "teaching"
            return None, f"Great work! You moved from learner to tutor for {course_name}."
        return None, f"{reason} You are still learning it."
    return None, None


def _check_final_challenge(user_skill, score: float, terminated: bool, course_name: str, outcome):
    """A learner who has done the required sessions and now passes finishes the
    course (100% progress, certificate unlocked). An Arena attempt taken BEFORE
    those sessions doesn't count. Returns (completed now?, message)."""
    ready_for_final = (
        user_skill.role == "learning"
        and user_skill.course_completed_at is None
        and (user_skill.sessions_completed or 0) >= SESSIONS_FOR_FINAL
    )
    if not ready_for_final:
        return False, outcome
    if score >= FINAL_PASS_SCORE and not terminated:
        user_skill.course_completed_at = utc_now()
        return True, f"You passed the final challenge and completed {course_name}! Your certificate is ready on the Progress page."
    if not outcome:
        if terminated and score >= FINAL_PASS_SCORE:
            outcome = (f"This final challenge ended early (rule violations or time over), so it can't "
                       f"complete {course_name}. You can try again.")
        else:
            outcome = f"You need {FINAL_PASS_SCORE}% in this final challenge to complete {course_name}. You can try again."
    return False, outcome


# ---------------------------------------------------------------------------
# Submit
# ---------------------------------------------------------------------------
@router.post("/submit", response_model=schemas.AssessmentResult)
def submit_assessment(
    payload: schemas.AssessmentSubmit,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    terminated = payload.terminated
    violations = max(0, payload.violations)

    # 1. Claim the attempt. Every attempt must come from POST /assessments/start.
    # (The old fallback scored a client-chosen skill against placeholder
    # questions and handed out free badges.)
    if not payload.attempt_id:
        raise HTTPException(status_code=400, detail="Start the assessment first (missing attempt_id).")
    session = db.query(models.AssessmentSession).filter(models.AssessmentSession.id == payload.attempt_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assessment attempt not found")
    now = utc_now()
    # Atomic claim, so two near-simultaneous submits (double click, timer +
    # violation auto-submit) cannot both be scored.
    claimed = (
        db.query(models.AssessmentSession)
        .filter(models.AssessmentSession.id == session.id, models.AssessmentSession.submitted_at.is_(None))
        .update({models.AssessmentSession.submitted_at: now}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise HTTPException(status_code=409, detail="This assessment has already been submitted")
    db.commit()
    db.refresh(session)

    late = session.expires_at is not None and now > as_utc(session.expires_at) + dt.timedelta(seconds=ARENA_GRACE_SECONDS)
    if late:
        terminated = True
    session.violations = violations
    session.terminated = terminated
    questions = session.questions
    skill_name = session.skill_name
    if not questions:
        raise HTTPException(status_code=404, detail="No questions for this skill")

    # 2. Score. Answers sent after the time limit (plus grace) are not counted.
    submitted = {} if late else {a.question_id: a.answer for a in payload.answers}
    score, weak_topics, topic_mastery, coding_feedback = _score_answers(questions, submitted)
    level = level_for_score(score)
    badge = badge_for_score(score)
    try:
        roadmap = build_study_plan(skill_name, level, score, weak_topics, topic_mastery)
    except Exception as err:  # noqa: BLE001
        logger.warning("[arena] build_study_plan failed for %s: %s", skill_name, err)
        roadmap = study_plan_for_topics(weak_topics)
    study_plan = coding_feedback + roadmap

    # 3. Save the attempt and the weekly history.
    skill = get_or_create_skill(db, skill_name)
    # Did this user ever reach a badge score in this course before? Points for
    # a first badge are given once per course, even if the course is removed
    # and added again.
    had_badge_before = (
        db.query(models.AssessmentAttempt)
        .filter(
            models.AssessmentAttempt.user_id == current_user.id,
            models.AssessmentAttempt.skill_id == skill.id,
            models.AssessmentAttempt.score >= BADGE_MIN_SCORE,
        )
        .first()
        is not None
    )
    attempt = models.AssessmentAttempt(
        user_id=current_user.id, skill_id=skill.id, score=score, weak_topics=",".join(weak_topics),
    )
    db.add(attempt)
    is_counted = _record_weekly_attempt(db, current_user.id, skill.id, score)

    # 4. Course role (learner / tutor) — decided by the server.
    wants_to_teach = (payload.role or "").strip().lower() == "teaching"
    can_promote = not terminated  # violations or a late submit never make anyone a tutor
    user_skill = user_course(db, current_user.id, skill.id)
    if not user_skill and course_count(db, current_user.id) >= MAX_COURSES:
        # The slot was free at /start but the user filled it meanwhile.
        # The attempt is still recorded; no course row is created.
        db.commit()
        return schemas.AssessmentResult(
            score=score, level=level, badge=badge, weak_topics=weak_topics, study_plan=study_plan,
            violations=violations, terminated=terminated, counted=is_counted, role=None,
            outcome_message=f"You already have {MAX_COURSES} courses, so {skill.name} was not added.",
            topic_mastery=topic_mastery,
        )
    new_role, outcome = _apply_role_rules(user_skill, wants_to_teach, can_promote, score, skill.name)
    if user_skill is None:
        user_skill = models.UserSkill(user_id=current_user.id, skill_id=skill.id, role=new_role)
        db.add(user_skill)

    # 5. Final challenge (finishes the course for a learner after 5 sessions).
    course_completed_now, outcome = _check_final_challenge(user_skill, score, terminated, skill.name, outcome)

    # 6. Update the course row, points and notifications.
    user_skill.latest_score = score
    user_skill.level_num = score_to_level(score)
    user_skill.level = level
    user_skill.badge = badge
    user_skill.progress_percentage = progress_for(user_skill)
    if badge and not had_badge_before:
        current_user.points += FIRST_BADGE_POINTS
    db.commit()

    create_notification(db, current_user.id, "assessment", "Assessment Completed", f"You scored {score}% on {skill.name}", attempt.id, "assessment")
    if badge:
        create_notification(db, current_user.id, "assessment", "Badge Earned", f"You earned a {badge} badge in {skill.name}!", attempt.id, "assessment")

    # Tell open demand requesters a tutor is available — only when this user
    # actually TEACHES the course (a learner's score must not trigger it).
    if user_skill.role == "teaching":
        notify_requesters_on_teacher_level_qualified(
            db=db, teacher_id=current_user.id, skill_id=skill.id, new_level_num=user_skill.level_num,
        )

    return schemas.AssessmentResult(
        score=score, level=level, badge=badge,
        weak_topics=weak_topics, study_plan=study_plan,
        violations=violations, terminated=terminated,
        counted=is_counted, role=user_skill.role,
        course_completed=course_completed_now, outcome_message=outcome,
        topic_mastery=topic_mastery,
    )
