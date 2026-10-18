"""
Demand Router — POST /demand/request & GET /demand/mine

Handles skill demand requests when no eligible teacher is available.
- Checks if an eligible teacher exists at learner's level; if yes, returns that teacher without creating a DemandRequest.
- If no teacher exists, creates a DemandRequest and notifies eligible / qualified users.
- Enforces 3 open requests limit and 24h re-request cooldown on closed requests.
- Never leaks user email or phone in notifications or responses.
"""
import datetime as dt
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .. import models, schemas, auth
from ..database import get_db
from ..utils.levels import is_eligible_to_teach
from ..utils.timezone import utc_now
from ..notification_service import create_notification
from ..services.course_rules import clean_course_name, find_course, user_course

router = APIRouter(prefix="/demand", tags=["demand"])


@router.post("/request", response_model=schemas.DemandResponse)
def create_demand_request(
    payload: schemas.DemandRequestCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a demand request for a skill when no eligible teacher is available.
    1. If an eligible teacher exists at the learner's level, returns that teacher instead.
    2. Otherwise, creates a DemandRequest and notifies eligible users.
    3. Enforces rate limits (max 3 open, 24h cooldown after fulfilled/expired).
    """
    # ── 1. Resolve skill ──────────────────────────────────────────────────────
    skill = None
    if payload.skill_id:
        skill = db.query(models.Skill).filter(models.Skill.id == payload.skill_id).first()
    if not skill and payload.skill_name:
        skill = find_course(db, clean_course_name(payload.skill_name))

    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found"
        )

    # ── 2. Determine learner's level ──────────────────────────────────────────
    learner_us = user_course(db, current_user.id, skill.id)
    # A teacher of this course can't ask for a tutor in it (one role per course).
    if learner_us and learner_us.role == "teaching":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You teach {skill.name}, so you can't request a tutor for it.",
        )
    learner_level_num = (
        learner_us.level_num
        if (learner_us and learner_us.level_num is not None)
        else 0
    )

    # ── 3. Check if an eligible teacher already exists ────────────────────────
    # Look for teachers who have listed this skill as "teaching" and satisfy eligibility
    candidate_teacher_skills = (
        db.query(models.UserSkill)
        .join(models.User)
        .filter(
            models.UserSkill.skill_id == skill.id,
            models.UserSkill.user_id != current_user.id,
            models.UserSkill.role == "teaching",
        )
        .all()
    )

    eligible_teachers = []
    for tus in candidate_teacher_skills:
        t_lvl = tus.level_num if tus.level_num is not None else 0
        if is_eligible_to_teach(t_lvl, learner_level_num):
            eligible_teachers.append((tus.user, t_lvl))

    if eligible_teachers:
        # Sort by level descending
        eligible_teachers.sort(key=lambda x: x[1], reverse=True)
        best_teacher, best_lvl = eligible_teachers[0]

        # Return that teacher without creating a DemandRequest
        return schemas.DemandResponse(
            status="teacher_available",
            message=f"An eligible teacher ({best_teacher.name}) is already available for {skill.name}.",
            teacher=schemas.DemandTeacherOut(
                id=best_teacher.id,
                user_id=best_teacher.id,
                name=best_teacher.name,
                college=best_teacher.college or "",
                level_num=best_lvl,
                skill_name=skill.name,
            ),
            demand_request=None,
            id=best_teacher.id,
            user_id=best_teacher.id,
            name=best_teacher.name,
            skill_id=skill.id,
            skill_name=skill.name,
            level_num=best_lvl,
        )

    # ── 4. Rate-limit checks ──────────────────────────────────────────────────
    # Check already open for this exact skill
    already_open = (
        db.query(models.DemandRequest)
        .filter(
            models.DemandRequest.requester_id == current_user.id,
            models.DemandRequest.skill_id == skill.id,
            models.DemandRequest.status == "open",
        )
        .first()
    )
    if already_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an open demand request for this skill.",
        )

    # Limit to at most 3 open demand requests across all skills
    open_count = (
        db.query(models.DemandRequest)
        .filter(
            models.DemandRequest.requester_id == current_user.id,
            models.DemandRequest.status == "open",
        )
        .count()
    )
    if open_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can have at most 3 open demand requests at a time.",
        )

    # Cooldown: cannot re-request same skill within 24 hours of expiring/fulfilled
    cutoff = utc_now() - dt.timedelta(hours=24)
    recent_closed = (
        db.query(models.DemandRequest)
        .filter(
            models.DemandRequest.requester_id == current_user.id,
            models.DemandRequest.skill_id == skill.id,
            models.DemandRequest.status.in_(["fulfilled", "expired"]),
            # Time it was fulfilled/expired (updated_at), not when it was opened.
            models.DemandRequest.updated_at >= cutoff,
        )
        .first()
    )
    if recent_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot re-request the same skill within 24 hours of a previous request.",
        )

    # ── 5. Create DemandRequest ───────────────────────────────────────────────
    now = utc_now()
    dr = models.DemandRequest(
        requester_id=current_user.id,
        skill_id=skill.id,
        learner_level_num=learner_level_num,
        status="open",
        created_at=now,
    )
    db.add(dr)
    db.commit()
    db.refresh(dr)

    # ── 6. Notify eligible users ──────────────────────────────────────────────
    # Find every user who has this skill on their profile (even if not listed as "teaching")
    potential_user_skills = (
        db.query(models.UserSkill)
        .filter(
            models.UserSkill.skill_id == skill.id,
            models.UserSkill.user_id != current_user.id,
        )
        .all()
    )

    # Group by user_id so each distinct user is notified once
    users_checked = {}
    for us in potential_user_skills:
        u_id = us.user_id
        if u_id not in users_checked:
            users_checked[u_id] = us
        else:
            # Keep highest level
            if (us.level_num or 0) > (users_checked[u_id].level_num or 0):
                users_checked[u_id] = us

    for u_id, us in users_checked.items():
        # Prevent duplicate teacher notifications: do not notify the same teacher twice for the same skill
        # while an open demand request for this skill is active
        already_notified = (
            db.query(models.Notification)
            .join(models.DemandRequest, models.Notification.related_id == models.DemandRequest.id)
            .filter(
                models.Notification.user_id == u_id,
                models.Notification.type == "demand_request",
                models.DemandRequest.skill_id == skill.id,
                models.DemandRequest.status == "open",
                models.DemandRequest.id != dr.id,
            )
            .first()
        )
        if already_notified:
            continue

        u_lvl = us.level_num if us.level_num is not None else 0
        if is_eligible_to_teach(u_lvl, learner_level_num):
            msg = f"{current_user.name} wants to learn {skill.name}. You're eligible to teach it — send them a request"
        else:
            # Has skill on profile but unverified or below threshold
            msg = f"{current_user.name} wants to learn {skill.name}. You're eligible to teach it — take the assessment to confirm"

        create_notification(
            db=db,
            user_id=u_id,
            notification_type="demand_request",
            title="Skill Demand",
            message=msg,
            related_id=dr.id,
            related_type="demand_request",
        )

    return schemas.DemandResponse(
        status="open",
        message=f"Demand request created for {skill.name}.",
        demand_request=schemas.DemandRequestOut(
            id=dr.id,
            requester_id=dr.requester_id,
            skill_id=dr.skill_id,
            skill_name=skill.name,
            learner_level_num=dr.learner_level_num,
            status=dr.status,
            created_at=dr.created_at,
        ),
        teacher=None,
        id=dr.id,
        requester_id=dr.requester_id,
        skill_id=dr.skill_id,
        skill_name=skill.name,
        learner_level_num=dr.learner_level_num,
    )


@router.get("/mine", response_model=List[schemas.DemandRequestOut])
def get_my_demand_requests(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """List the authenticated user's demand requests."""
    demands = (
        db.query(models.DemandRequest)
        .filter(models.DemandRequest.requester_id == current_user.id)
        .order_by(desc(models.DemandRequest.created_at))
        .all()
    )
    result = []
    for d in demands:
        s_name = d.skill.name if d.skill else ""
        result.append(
            schemas.DemandRequestOut(
                id=d.id,
                requester_id=d.requester_id,
                skill_id=d.skill_id,
                skill_name=s_name,
                learner_level_num=d.learner_level_num,
                status=d.status,
                created_at=d.created_at,
            )
        )
    return result
