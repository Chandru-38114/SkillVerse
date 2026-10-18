"""
Report Card Router — private GET /report-card/me

Provides a comprehensive overview of a user's:
- Skills overview (level_num, best score, counted weeks, trend)
- Progress history (last 12 counted weeks per skill)
- Learning activity (sessions attended, total learning minutes, distinct skills learned)
- Teaching activity (sessions given, total teaching minutes, distinct skills taught)
- Exchange history (completed exchange groups with kind and member names)
- Points breakdown (current total and split by source)
- Reviews received (average rating, review count, 3 most recent comments)

No public version, no email/phone leakage, no answer key leakage.
"""
import datetime as dt
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/report-card", tags=["report-card"])


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


@router.get("/me", response_model=schemas.ReportCardOut)
def get_my_report_card(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id

    # ── 1. Skills overview & Progress history ─────────────────────────────────
    user_skills = (
        db.query(models.UserSkill)
        .filter(models.UserSkill.user_id == user_id)
        .all()
    )

    skills_overview: List[schemas.SkillOverviewItem] = []
    progress_history: List[schemas.ProgressHistoryItem] = []

    for us in user_skills:
        skill = us.skill
        skill_name = skill.name if skill else f"Skill #{us.skill_id}"

        # Fetch counted weekly attempts for this skill, ordered by week_start asc
        counted_attempts = (
            db.query(models.WeeklyAttempt)
            .filter(
                models.WeeklyAttempt.user_id == user_id,
                models.WeeklyAttempt.skill_id == us.skill_id,
                models.WeeklyAttempt.counted == True,
            )
            .order_by(models.WeeklyAttempt.week_start.asc())
            .all()
        )

        counted_weeks_count = len(counted_attempts)

        # Best score
        all_attempts_scores = [a.score for a in counted_attempts]
        if us.latest_score is not None:
            all_attempts_scores.append(us.latest_score)
        best_score = max(all_attempts_scores) if all_attempts_scores else None

        # Trend comparing the last two counted weeks
        if len(counted_attempts) >= 2:
            prev_score = counted_attempts[-2].score
            curr_score = counted_attempts[-1].score
            if curr_score > prev_score:
                trend = "up"
            elif curr_score < prev_score:
                trend = "down"
            else:
                trend = "flat"
        else:
            trend = "flat"

        skills_overview.append(
            schemas.SkillOverviewItem(
                skill_name=skill_name,
                level_num=us.level_num or 0,
                best_score=best_score,
                counted_weeks=counted_weeks_count,
                trend=trend,
            )
        )

        # Last 12 counted weeks as {week_start, score}
        last_12 = counted_attempts[-12:]
        entries = [
            schemas.ProgressHistoryEntry(
                week_start=str(att.week_start),
                score=att.score,
            )
            for att in last_12
        ]
        progress_history.append(
            schemas.ProgressHistoryItem(
                skill_name=skill_name,
                history=entries,
            )
        )

    # ── 2. Learning Activity ──────────────────────────────────────────────────
    # Completed sessions where current user was learner
    learner_completed_sessions = (
        db.query(models.Session)
        .filter(
            models.Session.learner_id == user_id,
            models.Session.status == "completed",
        )
        .all()
    )

    learning_sessions_count = len(learner_completed_sessions)
    total_learning_minutes = sum(_calculate_session_duration(s) for s in learner_completed_sessions)
    distinct_skills_learned = sorted(list(set(s.skill for s in learner_completed_sessions if s.skill)))

    learning_activity = schemas.LearningActivitySummary(
        sessions_attended=learning_sessions_count,
        total_learning_minutes=total_learning_minutes,
        distinct_skills_learned=distinct_skills_learned,
    )

    # ── 3. Teaching Activity ──────────────────────────────────────────────────
    # Completed sessions where current user was tutor
    teacher_completed_sessions = (
        db.query(models.Session)
        .filter(
            models.Session.tutor_id == user_id,
            models.Session.status == "completed",
        )
        .all()
    )

    teaching_sessions_count = len(teacher_completed_sessions)
    total_teaching_minutes = sum(_calculate_session_duration(s) for s in teacher_completed_sessions)
    distinct_skills_taught = sorted(list(set(s.skill for s in teacher_completed_sessions if s.skill)))

    teaching_activity = schemas.TeachingActivitySummary(
        sessions_given=teaching_sessions_count,
        total_teaching_minutes=total_teaching_minutes,
        distinct_skills_taught=distinct_skills_taught,
    )

    # ── 4. Exchange History ───────────────────────────────────────────────────
    completed_groups = (
        db.query(models.ExchangeGroup)
        .join(models.ExchangeMember, models.ExchangeMember.group_id == models.ExchangeGroup.id)
        .filter(
            models.ExchangeMember.user_id == user_id,
            models.ExchangeGroup.status == "completed",
        )
        .all()
    )

    exchange_history: List[schemas.CompletedExchangeItem] = []
    for grp in completed_groups:
        other_mems = (
            db.query(models.User.name)
            .join(models.ExchangeMember, models.ExchangeMember.user_id == models.User.id)
            .filter(
                models.ExchangeMember.group_id == grp.id,
                models.User.id != user_id,
            )
            .all()
        )
        other_names = [m[0] for m in other_mems]
        exchange_history.append(
            schemas.CompletedExchangeItem(
                group_id=grp.id,
                kind=grp.kind,
                other_members=other_names,
            )
        )

    # ── 5. Points Breakdown ───────────────────────────────────────────────────
    total_pts = current_user.points or 0

    badges_earned_count = (
        db.query(models.UserSkill)
        .filter(
            models.UserSkill.user_id == user_id,
            models.UserSkill.badge != None,
            models.UserSkill.badge != "",
        )
        .count()
    )
    raw_assessment = badges_earned_count * 50

    reviews_given_count = (
        db.query(models.Review)
        .filter(models.Review.reviewer_id == user_id)
        .count()
    )
    raw_review = reviews_given_count * 5

    initial_points = min(100, total_pts)
    rem = total_pts - initial_points

    assessment_points = min(raw_assessment, rem)
    rem -= assessment_points

    review_points = min(raw_review, rem)
    rem -= review_points

    teaching_points = rem

    split = {
        "initial": initial_points,
        "assessment": assessment_points,
        "teaching": teaching_points,
        "review": review_points,
    }

    points_breakdown = schemas.PointsBreakdown(
        total=total_pts,
        split=split,
    )

    # ── 6. Reviews Received ───────────────────────────────────────────────────
    reviews_received_query = (
        db.query(models.Review)
        .filter(models.Review.reviewee_id == user_id)
        .order_by(models.Review.created_at.desc())
    )
    reviews_list = reviews_received_query.all()
    review_count = len(reviews_list)
    average_rating = (
        round(sum(r.rating for r in reviews_list) / review_count, 1)
        if review_count > 0 else None
    )
    top_3_reviews = [
        schemas.ReviewCommentItem(
            rating=r.rating,
            comment=r.comment or "",
            created_at=r.created_at,
        )
        for r in reviews_list[:3]
    ]

    reviews_received_data = {
        "average_rating": average_rating,
        "review_count": review_count,
        "recent_reviews": top_3_reviews,
    }

    return schemas.ReportCardOut(
        skills_overview=skills_overview,
        progress_history=progress_history,
        learning_activity=learning_activity,
        teaching_activity=teaching_activity,
        exchange_history=exchange_history,
        points_breakdown=points_breakdown,
        reviews_received=reviews_received_data,
    )
