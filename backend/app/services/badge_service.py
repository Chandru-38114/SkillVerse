"""
Teacher badge service.
Defines the teacher badge catalog and evaluation logic.

Badges:
- Bronze:
    * First Class: taught first completed session (computable)
    * Quick Responder: 20 replies within 2 hours (stubbed, depends on Task 4A/chat response tracking)
- Silver:
    * Study Circle Regular: 5 study circles attended (stubbed, depends on Task 4A)
    * Senior Advisor: 10 Ask-a-Senior answers (stubbed, depends on Task 4A)
- Gold:
    * Five-Star Mentor: 4.8+ rating over 10+ sessions (computable)
    * Circle Builder: completed a three-way exchange circle (computable)
    * Hackathon Host: ran a community hackathon (stubbed, depends on Task 4A)
- Expert:
    * Centurion: 100 completed teaching sessions (computable)
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from .. import models


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


TEACHER_BADGES: Dict[str, Dict[str, Any]] = {
    # Bronze Tier
    "first_class": {
        "id": "first_class",
        "name": "First Class",
        "tier": "bronze",
        "description": "Taught first completed session",
        "icon": "grad_cap",
        "computable": True,
    },
    "quick_responder": {
        "id": "quick_responder",
        "name": "Quick Responder",
        "tier": "bronze",
        "description": "20 replies within 2 hours",
        "icon": "bolt",
        "computable": False,
        "stubbed": True,
        "stub_reason": "Depends on chat response time tracking (Task 4A)",
    },

    # Silver Tier
    "study_circle_regular": {
        "id": "study_circle_regular",
        "name": "Study Circle Regular",
        "tier": "silver",
        "description": "5 study circles attended",
        "icon": "chat_bubbles",
        "computable": False,
        "stubbed": True,
        "stub_reason": "Depends on Study Circles community feature (Task 4A)",
    },
    "senior_advisor": {
        "id": "senior_advisor",
        "name": "Senior Advisor",
        "tier": "silver",
        "description": "10 Ask-a-Senior answers",
        "icon": "chat_check",
        "computable": False,
        "stubbed": True,
        "stub_reason": "Depends on Ask-a-Senior community feature (Task 4A)",
    },

    # Gold Tier
    "five_star_mentor": {
        "id": "five_star_mentor",
        "name": "Five-Star Mentor",
        "tier": "gold",
        "description": "4.8+ rating over 10+ sessions",
        "icon": "star",
        "computable": True,
    },
    "circle_builder": {
        "id": "circle_builder",
        "name": "Circle Builder",
        "tier": "gold",
        "description": "Completed a three-way exchange circle",
        "icon": "triangle_dots",
        "computable": True,
    },
    "hackathon_host": {
        "id": "hackathon_host",
        "name": "Hackathon Host",
        "tier": "gold",
        "description": "Ran a community hackathon",
        "icon": "flag",
        "computable": False,
        "stubbed": True,
        "stub_reason": "Depends on Community Hackathons feature (Task 4A)",
    },

    # Expert Tier
    "centurion": {
        "id": "centurion",
        "name": "Centurion",
        "tier": "expert",
        "description": "100 completed teaching sessions",
        "icon": "trophy",
        "computable": True,
    },
}


def check_first_class(db: Session, user_id: int) -> bool:
    """Taught first completed session (tutor_id == user_id, status == 'completed')."""
    completed_sessions = (
        db.query(models.Session)
        .filter(
            models.Session.tutor_id == user_id,
            models.Session.status == "completed",
        )
        .count()
    )
    return completed_sessions >= 1


def check_centurion(db: Session, user_id: int) -> bool:
    """100 completed teaching sessions (tutor_id == user_id, status == 'completed')."""
    completed_sessions = (
        db.query(models.Session)
        .filter(
            models.Session.tutor_id == user_id,
            models.Session.status == "completed",
        )
        .count()
    )
    return completed_sessions >= 100


def check_five_star_mentor(db: Session, user_id: int) -> bool:
    """4.8+ rating over 10+ sessions (completed sessions taught >= 10 and avg review rating >= 4.8)."""
    completed_sessions = (
        db.query(models.Session)
        .filter(
            models.Session.tutor_id == user_id,
            models.Session.status == "completed",
        )
        .count()
    )
    if completed_sessions < 10:
        return False

    review_stats = (
        db.query(
            func.count(models.Review.id),
            func.avg(models.Review.rating),
        )
        .filter(models.Review.reviewee_id == user_id)
        .first()
    )
    if not review_stats:
        return False

    count, avg_rating = review_stats
    if not count or count == 0 or avg_rating is None:
        return False

    # Check 4.8+ rating threshold
    return round(float(avg_rating), 2) >= 4.80


def check_circle_builder(db: Session, user_id: int) -> bool:
    """Completed a three-way exchange circle (ExchangeGroup kind='cycle', status='completed')."""
    # Check membership in a completed cycle group
    member_match = (
        db.query(models.ExchangeGroup.id)
        .join(models.ExchangeMember, models.ExchangeMember.group_id == models.ExchangeGroup.id)
        .filter(
            models.ExchangeMember.user_id == user_id,
            models.ExchangeGroup.kind == "cycle",
            models.ExchangeGroup.status == "completed",
        )
        .count()
    )
    if member_match > 0:
        return True

    # Check if user had a leg (teacher or learner) in a completed cycle group
    leg_match = (
        db.query(models.ExchangeGroup.id)
        .join(models.ExchangeLeg, models.ExchangeLeg.group_id == models.ExchangeGroup.id)
        .filter(
            or_(
                models.ExchangeLeg.teacher_id == user_id,
                models.ExchangeLeg.learner_id == user_id,
            ),
            models.ExchangeGroup.kind == "cycle",
            models.ExchangeGroup.status == "completed",
        )
        .count()
    )
    return leg_match > 0


AWARD_CHECKERS = {
    "first_class": check_first_class,
    "five_star_mentor": check_five_star_mentor,
    "circle_builder": check_circle_builder,
    "centurion": check_centurion,
}


def check_and_award_teacher_badges(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """
    Evaluates computable badges for user_id and persists newly earned ones to UserBadge.
    Returns list of all earned badges for this user.
    """
    # Fetch existing earned badge IDs
    existing = set(
        b.badge_id
        for b in db.query(models.UserBadge.badge_id)
        .filter(models.UserBadge.user_id == user_id)
        .all()
    )

    newly_awarded = False
    for badge_id, checker in AWARD_CHECKERS.items():
        if badge_id not in existing:
            if checker(db, user_id):
                user_badge = models.UserBadge(
                    user_id=user_id,
                    badge_id=badge_id,
                    earned_at=utc_now(),
                )
                db.add(user_badge)
                newly_awarded = True

    if newly_awarded:
        db.commit()

    return get_user_earned_badges(db, user_id)


def get_user_earned_badges(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """
    Returns ONLY the badges that are actually earned by user_id.
    Unearned / locked badges are NOT returned, preventing leaking criteria placeholders.
    """
    earned_rows = (
        db.query(models.UserBadge)
        .filter(models.UserBadge.user_id == user_id)
        .order_by(models.UserBadge.earned_at.asc())
        .all()
    )

    results: List[Dict[str, Any]] = []
    for row in earned_rows:
        defn = TEACHER_BADGES.get(row.badge_id)
        if defn:
            results.append({
                "id": defn["id"],
                "name": defn["name"],
                "tier": defn["tier"],
                "description": defn["description"],
                "icon": defn["icon"],
                "earned": True,
                "earned_at": row.earned_at.isoformat() if row.earned_at else None,
            })
    return results


def award_badges_retroactively(db: Session) -> Dict[int, List[str]]:
    """
    Iterates through all existing users, evaluates their qualification for the 4
    computable badges based on existing sessions, reviews, and exchanges,
    and awards them retroactively so testing and production have real data.
    """
    user_ids = [u.id for u in db.query(models.User.id).all()]
    awarded_map: Dict[int, List[str]] = {}

    for uid in user_ids:
        earned = check_and_award_teacher_badges(db, uid)
        if earned:
            awarded_map[uid] = [b["id"] for b in earned]

    return awarded_map
