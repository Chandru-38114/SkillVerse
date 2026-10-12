"""
Teacher Stats Service.

Shared calculation helpers for public and private teacher statistics.
Guarantees consistent logic between /teacher-stats/me and /marketplace/search.
Avoids N+1 queries by utilizing grouped aggregation.
"""
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models


def get_teacher_public_stats_for_users(db: Session, user_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    """
    Computes a public summary for users who have taught at least one completed session.
    
    Returns a dict mapping user_id -> {
        "average_rating": float | None,
        "review_count": int,
        "sessions_taught": int,
        "teaching_since": str,
    }
    
    For users who have NOT taught any completed sessions, they will NOT be in the returned dict.
    Runs exactly ONE grouped query for sessions and ONE grouped query for reviews (no N+1).
    """
    if not user_ids:
        return {}

    # Grouped query 1: completed sessions taught by these users
    session_rows = (
        db.query(
            models.Session.tutor_id,
            func.count(models.Session.id).label("sessions_count"),
            func.min(models.Session.session_date).label("min_session_date"),
            func.min(models.Session.created_at).label("min_created_at"),
        )
        .filter(
            models.Session.tutor_id.in_(user_ids),
            models.Session.status == "completed"
        )
        .group_by(models.Session.tutor_id)
        .all()
    )

    if not session_rows:
        return {}

    tutors_map = {}
    for r in session_rows:
        if r.sessions_count and r.sessions_count > 0:
            teaching_since = (
                str(r.min_session_date)
                if r.min_session_date
                else (
                    str(r.min_created_at.date())
                    if hasattr(r.min_created_at, 'date')
                    else str(r.min_created_at)[:10]
                )
            )
            tutors_map[r.tutor_id] = {
                "sessions_taught": int(r.sessions_count),
                "teaching_since": teaching_since,
            }

    if not tutors_map:
        return {}

    # Grouped query 2: reviews received for teaching
    # Only for the tutors who actually have completed teaching sessions
    tutor_ids = list(tutors_map.keys())
    reviews_rows = (
        db.query(
            models.Review.reviewee_id,
            func.count(models.Review.id).label("count"),
            func.avg(models.Review.rating).label("avg"),
        )
        .filter(models.Review.reviewee_id.in_(tutor_ids))
        .group_by(models.Review.reviewee_id)
        .all()
    )

    reviews_map = {
        r.reviewee_id: {
            "review_count": int(r.count),
            "average_rating": round(float(r.avg), 1) if r.avg is not None else None,
        }
        for r in reviews_rows
    }

    result = {}
    for t_id, s_info in tutors_map.items():
        r_info = reviews_map.get(t_id, {"review_count": 0, "average_rating": None})
        result[t_id] = {
            "sessions_taught": s_info["sessions_taught"],
            "teaching_since": s_info["teaching_since"],
            "review_count": r_info["review_count"],
            "average_rating": r_info["average_rating"],
        }

    return result
