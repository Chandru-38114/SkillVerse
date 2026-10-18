"""
Demand Request Service.

Handles skill demand notification flows, fulfillment triggers, and rate-limiting rules.
Guarantees privacy: never exposes any user's email or phone number in notifications.
"""
from typing import List
from sqlalchemy.orm import Session

from .. import models
from ..utils.levels import is_eligible_to_teach
from ..notification_service import create_notification


def notify_requesters_on_teacher_level_qualified(
    db: Session,
    teacher_id: int,
    skill_id: int,
    new_level_num: int,
) -> List[int]:
    """
    When a user reaches level_num for a skill, check if any open DemandRequests
    can now be satisfied by this teacher.
    If so, notify the demand requester that a teacher is now available.
    
    Privacy rule: Only teacher's name and skill name are included in notification.
    Never exposes email or phone number.
    Returns list of notified requester user IDs.
    """
    open_demands = (
        db.query(models.DemandRequest)
        .filter(
            models.DemandRequest.skill_id == skill_id,
            models.DemandRequest.status == "open",
            models.DemandRequest.requester_id != teacher_id,
        )
        .all()
    )
    if not open_demands:
        return []

    teacher = db.query(models.User).filter(models.User.id == teacher_id).first()
    skill = db.query(models.Skill).filter(models.Skill.id == skill_id).first()
    if not teacher or not skill:
        return []

    notified = []
    for dr in open_demands:
        if is_eligible_to_teach(new_level_num, dr.learner_level_num):
            create_notification(
                db=db,
                user_id=dr.requester_id,
                notification_type="teacher_available",
                title="Teacher Available",
                message=f"A teacher is now available for {skill.name}! {teacher.name} has qualified to teach.",
                related_id=dr.id,
                related_type="demand_request",
            )
            notified.append(dr.requester_id)

    return notified


def fulfill_demand_request_on_connection(
    db: Session,
    user_a_id: int,
    user_b_id: int,
    skill_id: int,
) -> int:
    """
    When a connection request between user_a and user_b for skill_id is accepted,
    mark any open DemandRequest by either user for that skill as fulfilled.
    Returns count of fulfilled requests.
    """
    demands = (
        db.query(models.DemandRequest)
        .filter(
            models.DemandRequest.skill_id == skill_id,
            models.DemandRequest.status == "open",
            models.DemandRequest.requester_id.in_([user_a_id, user_b_id]),
        )
        .all()
    )
    count = 0
    for dr in demands:
        dr.status = "fulfilled"
        count += 1
    if demands:
        db.commit()
    return count
