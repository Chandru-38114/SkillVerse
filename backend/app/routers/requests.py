from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db
from ..services.demand_service import fulfill_demand_request_on_connection
from .users import get_or_create_skill

router = APIRouter(prefix="/requests", tags=["requests"])


def _to_out(r: models.ConnectionRequest) -> schemas.ConnectionRequestOut:
    return schemas.ConnectionRequestOut(
        id=r.id, from_user_id=r.from_user_id, 
        from_user_name=r.from_user.name if r.from_user else "Deleted User",
        to_user_id=r.to_user_id, 
        to_user_name=r.to_user.name if r.to_user else "Deleted User",
        skill_name=r.skill.name if r.skill else "Unknown Skill", 
        message=r.message, status=r.status,
        created_at=r.created_at,
        # Two-way learning context — pass through as-is (None for old rows)
        learner_current_level=r.learner_current_level,
        learner_topics=r.learner_topics,
        learner_goals=r.learner_goals,
        learner_can_teach=r.learner_can_teach,
        learner_teach_proficiency=r.learner_teach_proficiency,
        from_user_avatar=getattr(r.from_user, "profile_picture_url", None) if r.from_user else None,
        to_user_avatar=getattr(r.to_user, "profile_picture_url", None) if r.to_user else None,
    )


def accepted_request_for_leg(db: Session, learner_id: int, teacher_id: int, skill_id: int, message: str) -> models.ConnectionRequest:
    """Return an ACCEPTED request where learner -> teacher for this skill,
    reusing an existing pending/accepted one instead of inserting a duplicate
    (exchanges used to create a second connection when one already existed).
    Direction matters: the request's to_user is always the tutor."""
    existing = (
        db.query(models.ConnectionRequest)
        .filter(
            models.ConnectionRequest.from_user_id == learner_id,
            models.ConnectionRequest.to_user_id == teacher_id,
            models.ConnectionRequest.skill_id == skill_id,
            models.ConnectionRequest.status.in_(["pending", "accepted"]),
        )
        .order_by(models.ConnectionRequest.created_at.desc())
        .first()
    )
    if existing:
        existing.status = "accepted"
        return existing
    req = models.ConnectionRequest(
        from_user_id=learner_id, to_user_id=teacher_id, skill_id=skill_id,
        message=message, status="accepted",
    )
    db.add(req)
    db.flush()
    return req


def _find_active_request(
    db: Session,
    user_a_id: int,
    user_b_id: int,
    skill_id: int,
) -> Optional[models.ConnectionRequest]:
    """
    Return the first ConnectionRequest between user_a and user_b (in EITHER
    direction) for the given skill that is NOT in a terminal/reset state.

    'declined' and 'completed' are both treated as resets — users are allowed
    to send a fresh request after either outcome.
    """
    return (
        db.query(models.ConnectionRequest)
        .filter(
            models.ConnectionRequest.skill_id == skill_id,
            models.ConnectionRequest.status.notin_(["declined", "completed"]),
            or_(
                and_(
                    models.ConnectionRequest.from_user_id == user_a_id,
                    models.ConnectionRequest.to_user_id == user_b_id,
                ),
                and_(
                    models.ConnectionRequest.from_user_id == user_b_id,
                    models.ConnectionRequest.to_user_id == user_a_id,
                ),
            ),
        )
        .first()
    )


@router.post("", response_model=schemas.ConnectionRequestOut)
def create_request(
    payload: schemas.ConnectionRequestCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    skill = get_or_create_skill(db, payload.skill_name)

    existing = _find_active_request(db, current_user.id, payload.to_user_id, skill.id)
    if existing:
        if existing.status == "accepted":
            raise HTTPException(
                status_code=409,
                detail="You are already connected with this user for this skill.",
            )
        # status == "pending"
        raise HTTPException(
            status_code=409,
            detail="A connection request is already pending with this user for this skill.",
        )

    req = models.ConnectionRequest(
        from_user_id=current_user.id,
        to_user_id=payload.to_user_id,
        skill_id=skill.id,
        message=payload.message or "",
        # Two-way learning context
        learner_current_level=payload.learner_current_level,
        learner_topics=payload.learner_topics,
        learner_goals=payload.learner_goals,
        learner_can_teach=payload.learner_can_teach,
        learner_teach_proficiency=payload.learner_teach_proficiency,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    create_notification(db, req.to_user_id, "request", "New Learning Request", f"{current_user.name} sent you a request for {skill.name}", req.id, "request")
    return _to_out(req)



@router.get("/status")
def get_connection_status(
    to_user_id: int = Query(..., description="The other user's ID"),
    skill_name: str = Query(..., description="The skill being requested"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the current relationship status between the logged-in user and
    `to_user_id` for `skill_name`, in either direction.

    Response shape:
        { "status": "none" | "pending" | "accepted" | "declined", "request_id": int | null }
    """
    skill = db.query(models.Skill).filter(models.Skill.name.ilike(skill_name.strip())).first()
    if not skill:
        return {"status": "none", "request_id": None}

    # Check in both directions, including declined, so the UI can show the
    # correct label even for previously-declined requests.
    req = (
        db.query(models.ConnectionRequest)
        .filter(
            models.ConnectionRequest.skill_id == skill.id,
            or_(
                and_(
                    models.ConnectionRequest.from_user_id == current_user.id,
                    models.ConnectionRequest.to_user_id == to_user_id,
                ),
                and_(
                    models.ConnectionRequest.from_user_id == to_user_id,
                    models.ConnectionRequest.to_user_id == current_user.id,
                ),
            ),
        )
        # Most recent first — a new request after a decline should take precedence.
        .order_by(models.ConnectionRequest.created_at.desc())
        .first()
    )

    if not req:
        return {"status": "none", "request_id": None}

    return {"status": req.status, "request_id": req.id}


@router.get("/incoming", response_model=List[schemas.ConnectionRequestOut])
def incoming_requests(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.to_user_id == current_user.id
    ).order_by(models.ConnectionRequest.created_at.desc()).all()
    return [_to_out(r) for r in rows]


@router.get("/outgoing", response_model=List[schemas.ConnectionRequestOut])
def outgoing_requests(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.from_user_id == current_user.id
    ).order_by(models.ConnectionRequest.created_at.desc()).all()
    return [_to_out(r) for r in rows]


from ..utils.levels import is_eligible_to_teach

@router.post("/{request_id}/respond", response_model=schemas.ConnectionRequestOut)
def respond_to_request(
    request_id: int,
    accept: bool,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req or req.to_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found")

    # Only a pending request can be answered. Without this, a stale tab could
    # flip an accepted/completed connection to declined (or re-open a
    # completed one and award completion points twice).
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"This request was already {req.status}.")

    req.status = "accepted" if accept else "declined"
    db.commit()
    db.refresh(req)
    other_user = req.from_user_id if req.to_user_id == current_user.id else req.to_user_id
    if req.status == "accepted":
        create_notification(db, other_user, "request", "Learning Request Accepted", f"{current_user.name} accepted your request", req.id, "request")

        # Fulfill any open demand requests for this skill between these users
        fulfill_demand_request_on_connection(
            db=db,
            user_a_id=req.from_user_id,
            user_b_id=req.to_user_id,
            skill_id=req.skill_id,
        )

        # Check for two-way exchange (Pair Exchange)
        # If the requester offered a skill to teach (learner_can_teach)
        if req.learner_can_teach:
            reciprocal_skill_name = req.learner_can_teach.split(",")[0].strip()
            if reciprocal_skill_name:
                recip_skill = get_or_create_skill(db, reciprocal_skill_name)
                # Check eligibility for both legs:
                # Leg 1: current_user (req.to_user_id) teaches req.from_user_id skill req.skill_id
                t1_us = db.query(models.UserSkill).filter(
                    models.UserSkill.user_id == req.to_user_id,
                    models.UserSkill.skill_id == req.skill_id
                ).first()
                l1_us = db.query(models.UserSkill).filter(
                    models.UserSkill.user_id == req.from_user_id,
                    models.UserSkill.skill_id == req.skill_id
                ).first()
                t1_lvl = t1_us.level_num if t1_us and t1_us.level_num is not None else 0
                l1_lvl = l1_us.level_num if l1_us and l1_us.level_num is not None else 0

                # Leg 2: req.from_user_id teaches current_user (req.to_user_id) recip_skill
                t2_us = db.query(models.UserSkill).filter(
                    models.UserSkill.user_id == req.from_user_id,
                    models.UserSkill.skill_id == recip_skill.id
                ).first()
                l2_us = db.query(models.UserSkill).filter(
                    models.UserSkill.user_id == req.to_user_id,
                    models.UserSkill.skill_id == recip_skill.id
                ).first()
                t2_lvl = t2_us.level_num if t2_us and t2_us.level_num is not None else 0
                l2_lvl = l2_us.level_num if l2_us and l2_us.level_num is not None else 0

                if is_eligible_to_teach(t1_lvl, l1_lvl) and is_eligible_to_teach(t2_lvl, l2_lvl):
                    # Create reciprocal connection request
                    recip_req = accepted_request_for_leg(
                        db, learner_id=req.to_user_id, teacher_id=req.from_user_id,
                        skill_id=recip_skill.id, message=f"Reciprocal exchange for {req.skill.name}",
                    )

                    # Create exchange group of kind "pair"
                    grp = models.ExchangeGroup(kind="pair", status="active")
                    db.add(grp)
                    db.flush()

                    # Exchange members
                    m1 = models.ExchangeMember(group_id=grp.id, user_id=req.from_user_id, accepted=True)
                    m2 = models.ExchangeMember(group_id=grp.id, user_id=req.to_user_id, accepted=True)
                    db.add_all([m1, m2])

                    # Two legs: one in each direction
                    leg1 = models.ExchangeLeg(
                        group_id=grp.id,
                        teacher_id=req.to_user_id,
                        learner_id=req.from_user_id,
                        skill_id=req.skill_id,
                        request_id=req.id,
                        status="active"
                    )
                    leg2 = models.ExchangeLeg(
                        group_id=grp.id,
                        teacher_id=req.from_user_id,
                        learner_id=req.to_user_id,
                        skill_id=recip_skill.id,
                        request_id=recip_req.id,
                        status="active"
                    )
                    db.add_all([leg1, leg2])
                    db.commit()
    else:
        create_notification(db, other_user, "request", "Learning Request Declined", f"{current_user.name} declined your request", req.id, "request")
    return _to_out(req)


@router.post("/{request_id}/complete", response_model=schemas.ConnectionRequestOut)
def complete_request(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark an accepted connection as completed.

    Rules enforced:
    - Only the two users who belong to the connection may complete it.
    - Only an 'accepted' connection can be completed.
    - pending / declined / already-completed requests are rejected with a
      clear 400 or 403 response.
    """
    req = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.id == request_id
    ).first()

    # 404 if it doesn't exist OR the caller is not part of this connection.
    if not req or current_user.id not in (req.from_user_id, req.to_user_id):
        raise HTTPException(status_code=404, detail="Connection not found")

    if req.status == "completed":
        raise HTTPException(status_code=400, detail="This session is already marked as completed.")

    if req.status != "accepted":
        raise HTTPException(
            status_code=400,
            detail=f"Only an accepted connection can be completed (current status: {req.status}).",
        )

    # Only allow completion if at least one session for this request has finished/completed
    finished_session = db.query(models.Session).filter(
        models.Session.request_id == req.id,
        models.Session.status == "completed"
    ).first()

    if not finished_session:
        raise HTTPException(status_code=400, detail="Hold a session before completing")

    req.status = "completed"

    # Award points only once per request
    if not getattr(req, "points_awarded", False):
        # If this request is part of an exchange leg, points are handled upon session delivery
        is_exchange = db.query(models.ExchangeLeg).filter(
            models.ExchangeLeg.request_id == req.id
        ).first() is not None

        if not is_exchange:
            learner = db.query(models.User).filter(models.User.id == req.from_user_id).first()
            teacher = db.query(models.User).filter(models.User.id == req.to_user_id).first()
            if learner:
                learner.points += 20
            if teacher:
                teacher.points += 20
        req.points_awarded = True

    db.commit()
    db.refresh(req)
    other_user = req.to_user_id if req.from_user_id == current_user.id else req.from_user_id
    create_notification(db, other_user, "request", "Session Completed", f"{current_user.name} marked the session as completed.", req.id, "request")
    return _to_out(req)