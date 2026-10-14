"""
Teacher Stats Router — private GET /teacher-stats/me

Provides statistics for teachers on SkillVerse:
- has_taught: false if the user has never taught a completed session.
- If has_taught: true:
  - Teaching experience: total hours taught (from completed sessions), "teaching since" date
  - Rating summary: average rating, review count, star breakdown (5 down to 1)
  - Session stats: total sessions taught, average session length (minutes)
  - Students helped: count of distinct learners taught, count of returning students (>=2 sessions)
  - Skill breakdown: per skill taught, level_num, sessions taught, average rating for that skill
  - Reliability: completion rate of accepted requests as teacher
  - Recent reviews: 5 most recent review comments with ratings as a teacher

No email, phone, or answer key leakage anywhere.
"""
import datetime as dt
from typing import Dict, List, Any, Optional
from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/teacher-stats", tags=["teacher-stats"])


def _calculate_session_duration(session: models.Session) -> int:
    try:
        st = dt.datetime.strptime(session.start_time, "%H:%M")
        en = dt.datetime.strptime(session.end_time, "%H:%M")
        duration = int((en - st).total_seconds() / 60)
        if duration < 0:
            duration += 24 * 60
        if duration == 0:
            duration = 60
        return duration
    except Exception:
        return 60


@router.get("/me", response_model=schemas.TeacherStatsOut)
def get_my_teacher_stats(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id

    # Find completed sessions taught by this user
    completed_teaching_sessions = (
        db.query(models.Session)
        .filter(
            models.Session.tutor_id == user_id,
            models.Session.status == "completed",
        )
        .order_by(models.Session.created_at.asc())
        .all()
    )

    if not completed_teaching_sessions:
        return schemas.TeacherStatsOut(has_taught=False)

    total_sessions_taught = len(completed_teaching_sessions)

    # ── 1. Teaching experience ────────────────────────────────────────────────
    # Total hours taught from completed sessions
    total_minutes = sum(_calculate_session_duration(s) for s in completed_teaching_sessions)
    total_hours_taught = round(total_minutes / 60.0, 1)

    # Teaching since = date of their first completed teaching session
    first_session = completed_teaching_sessions[0]
    # Use session_date string if available, else created_at.date()
    teaching_since_date = first_session.session_date
    if not teaching_since_date and first_session.created_at:
        teaching_since_date = str(first_session.created_at.date())

    teaching_experience = {
        "total_hours_taught": total_hours_taught,
        "teaching_since": str(teaching_since_date),
    }

    # ── 2. Rating summary & star breakdown ────────────────────────────────────
    # Reviews received as teacher (reviewee_id == user_id for sessions where tutor_id == user_id)
    # Get all reviews where reviewee_id == user_id and either session_id is in completed teaching sessions
    # or request has to_user_id == user_id
    teaching_session_ids = [s.id for s in completed_teaching_sessions]
    teacher_reviews = (
        db.query(models.Review)
        .filter(
            models.Review.reviewee_id == user_id,
            models.Review.session_id.in_(teaching_session_ids),
        )
        .order_by(models.Review.created_at.desc())
        .all()
    )
    # Older reviews without session_id: count them only if this user was the
    # request's tutor (to_user). The old fallback counted every review the user
    # ever received, including ones received as a learner.
    legacy_reviews = (
        db.query(models.Review)
        .join(models.ConnectionRequest, models.ConnectionRequest.id == models.Review.request_id)
        .filter(
            models.Review.reviewee_id == user_id,
            models.Review.session_id.is_(None),
            models.ConnectionRequest.to_user_id == user_id,
        )
        .all()
    )
    teacher_reviews = sorted(list(teacher_reviews) + legacy_reviews, key=lambda r: r.created_at or 0, reverse=True)

    review_count = len(teacher_reviews)
    average_rating = (
        round(sum(r.rating for r in teacher_reviews) / review_count, 1)
        if review_count > 0 else None
    )

    star_counts = Counter(r.rating for r in teacher_reviews)
    star_breakdown = {
        "star_5": star_counts.get(5, 0),
        "star_4": star_counts.get(4, 0),
        "star_3": star_counts.get(3, 0),
        "star_2": star_counts.get(2, 0),
        "star_1": star_counts.get(1, 0),
    }

    rating_summary = {
        "average_rating": average_rating,
        "review_count": review_count,
        "star_breakdown": star_breakdown,
    }

    # ── 3. Session stats ──────────────────────────────────────────────────────
    average_session_length = (
        round(total_minutes / total_sessions_taught, 1)
        if total_sessions_taught > 0 else 0.0
    )

    session_stats = {
        "total_sessions_taught": total_sessions_taught,
        "average_session_length": average_session_length,
    }

    # ── 4. Students helped ────────────────────────────────────────────────────
    learner_ids = [s.learner_id for s in completed_teaching_sessions]
    learner_counts = Counter(learner_ids)
    distinct_learners_taught = len(learner_counts)
    # Returning students = distinct learners who completed >= 2 sessions with this tutor
    returning_students_count = sum(1 for count in learner_counts.values() if count >= 2)

    students_help = {
        "distinct_learners_taught": distinct_learners_taught,
        "returning_students_count": returning_students_count,
    }

    # ── 5. Skill breakdown ────────────────────────────────────────────────────
    # Per skill taught: level_num, number of sessions taught, average rating for that skill
    # Group completed sessions by skill
    sessions_by_skill = {}
    for s in completed_teaching_sessions:
        skill_name = s.skill or "Unknown"
        sessions_by_skill.setdefault(skill_name, []).append(s)

    # Reviews mapped by session_id
    reviews_by_session = {}
    for r in teacher_reviews:
        if r.session_id:
            reviews_by_session.setdefault(r.session_id, []).append(r)

    # User's skill levels
    user_skills_map = {}
    user_skills = (
        db.query(models.UserSkill)
        .filter(models.UserSkill.user_id == user_id)
        .all()
    )
    for us in user_skills:
        if us.skill:
            user_skills_map[us.skill.name.lower()] = us.level_num or 0

    skill_breakdown_list: List[schemas.TeacherSkillBreakdownItem] = []
    for skill_name, skill_sessions in sessions_by_skill.items():
        lvl = user_skills_map.get(skill_name.lower(), 0)
        s_count = len(skill_sessions)
        
        # Calculate rating for this skill
        skill_session_ids = set(s.id for s in skill_sessions)
        skill_reviews = [
            r for r in teacher_reviews
            if r.session_id in skill_session_ids
        ]
        skill_avg_rating = (
            round(sum(r.rating for r in skill_reviews) / len(skill_reviews), 1)
            if skill_reviews else None
        )

        skill_breakdown_list.append(
            schemas.TeacherSkillBreakdownItem(
                skill_name=skill_name,
                level_num=lvl,
                sessions_taught=s_count,
                average_rating=skill_avg_rating,
            )
        )

    # Sort skill breakdown alphabetically or by sessions taught desc
    skill_breakdown_list.sort(key=lambda x: x.sessions_taught, reverse=True)

    # ── 6. Reliability ────────────────────────────────────────────────────────
    # Of all requests this user accepted as teacher, what share led to a completed session
    # vs were cancelled or never scheduled.
    # Where is this user accepted as teacher:
    # A connection request where:
    # - to_user_id == user_id (received request to teach) or leg teacher
    # - status in ('accepted', 'completed')
    accepted_teacher_requests = (
        db.query(models.ConnectionRequest)
        .filter(
            models.ConnectionRequest.to_user_id == user_id,
            models.ConnectionRequest.status.in_(["accepted", "completed"]),
        )
        .all()
    )

    total_accepted_requests = len(accepted_teacher_requests)
    completed_req_ids = set()

    for req in accepted_teacher_requests:
        # Check if this request had at least one completed session
        has_completed_sess = (
            db.query(models.Session)
            .filter(
                models.Session.request_id == req.id,
                models.Session.status == "completed",
            )
            .first()
        )
        if has_completed_sess:
            completed_req_ids.add(req.id)

    completed_sessions_count = len(completed_req_ids)
    cancelled_or_unscheduled = max(0, total_accepted_requests - completed_sessions_count)

    completion_rate = (
        round((completed_sessions_count / total_accepted_requests) * 100, 1)
        if total_accepted_requests > 0 else 100.0
    )

    reliability = {
        "completion_rate": completion_rate,
        "completed_sessions": completed_sessions_count,
        "cancelled_or_unscheduled": cancelled_or_unscheduled,
        "total_accepted_requests": total_accepted_requests,
    }

    # ── 7. Recent reviews (5 most recent review comments with ratings) ─────────
    recent_reviews_list = [
        schemas.ReviewCommentItem(
            rating=r.rating,
            comment=r.comment or "",
            created_at=r.created_at,
        )
        for r in teacher_reviews[:5]
    ]

    return schemas.TeacherStatsOut(
        has_taught=True,
        teaching_experience=teaching_experience,
        rating_summary=rating_summary,
        session_stats=session_stats,
        students_help=students_help,
        skill_breakdown=skill_breakdown_list,
        reliability=reliability,
        recent_reviews=recent_reviews_list,
    )
