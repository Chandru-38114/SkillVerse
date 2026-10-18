"""
Exchanges router — Pair and Three-way Circle exchanges.

Endpoints:
  GET  /exchanges/suggestions   Cycle suggestions for the current user (length 3, ranked by exchange scores)
  POST /exchanges/cycles        Propose a 3-way cycle exchange
  POST /exchanges/{id}/respond  Accept or decline participation in an exchange group
  GET  /exchanges/mine          List current user's exchange groups with their legs
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .. import models, auth
from ..database import get_db
from ..notification_service import create_notification
from ..services.cycles import find_cycle_suggestions_for_user
from ..services.course_rules import ensure_learning_course, teaching_problem
from .requests import accepted_request_for_leg

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CycleLegProposal(BaseModel):
    teacher_id: int
    learner_id: int
    skill_id: int


class ProposeCycleRequest(BaseModel):
    legs: List[CycleLegProposal]  # Exactly 3 legs forming A->B->C->A


class RespondCycleRequest(BaseModel):
    accept: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_group(grp: models.ExchangeGroup, db: Session):
    return {
        "id": grp.id,
        "kind": grp.kind,
        "status": grp.status,
        "created_at": grp.created_at,
        "members": [
            {
                "user_id": m.user_id,
                "name": m.user.name if m.user else f"User {m.user_id}",
                "accepted": m.accepted
            }
            for m in grp.members
        ],
        "legs": [
            {
                "id": leg.id,
                "teacher_id": leg.teacher_id,
                "teacher_name": leg.teacher.name if leg.teacher else f"User {leg.teacher_id}",
                "learner_id": leg.learner_id,
                "learner_name": leg.learner.name if leg.learner else f"User {leg.learner_id}",
                "skill_id": leg.skill_id,
                "skill_name": leg.skill.name if leg.skill else f"Skill {leg.skill_id}",
                "request_id": leg.request_id,
                "status": leg.status,
                "delivered_at": leg.delivered_at
            }
            for leg in grp.legs
        ]
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/suggestions")
def get_cycle_suggestions(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get 3-way cycle suggestions for the current user.
    """
    return find_cycle_suggestions_for_user(db, current_user.id)


@router.post("/cycles")
def propose_cycle(
    payload: ProposeCycleRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Propose a 3-way circular exchange.
    Enforces:
    - Exactly 3 legs.
    - Current user is one of the members.
    - Forms a valid cycle A->B->C->A.
    - User cannot be in two active cycles for the same skill.
    - All legs pass the eligibility rule.
    - Creates group in 'proposed' status, with 3 members (proposer accepted=True).
    - Sends notifications to the other two users.
    """
    legs_data = payload.legs
    if len(legs_data) != 3:
        raise HTTPException(status_code=400, detail="A cycle proposal must have exactly 3 legs.")

    # Validate that current_user is part of this cycle
    member_ids = {leg.teacher_id for leg in legs_data} | {leg.learner_id for leg in legs_data}
    if len(member_ids) != 3:
        raise HTTPException(status_code=400, detail="Cycle must involve exactly 3 distinct users.")
    if current_user.id not in member_ids:
        raise HTTPException(status_code=403, detail="You must be a member of the proposed cycle.")

    # Validate that it forms a closed cycle A->B->C->A
    next_map = {leg.teacher_id: leg.learner_id for leg in legs_data}
    curr = current_user.id
    visited = []
    for _ in range(3):
        if curr not in next_map:
            raise HTTPException(status_code=400, detail="Invalid cycle structure.")
        visited.append(curr)
        curr = next_map[curr]
    if curr != current_user.id or len(set(visited)) != 3:
        raise HTTPException(status_code=400, detail="Legs must form a complete cycle of 3 users.")

    # Check rule: a user cannot be in two active cycles for the same skill
    # Active/proposed cycles checking for each member & their skills
    for leg in legs_data:
        # Teacher or learner skill conflict check in active/proposed groups
        existing_conflict = (
            db.query(models.ExchangeLeg)
            .join(models.ExchangeGroup)
            .filter(
                models.ExchangeGroup.status.in_(["proposed", "active"]),
                models.ExchangeGroup.kind == "cycle",
                models.ExchangeLeg.skill_id == leg.skill_id,
                (models.ExchangeLeg.teacher_id == leg.teacher_id) | (models.ExchangeLeg.learner_id == leg.learner_id)
            )
            .first()
        )
        if existing_conflict:
            raise HTTPException(
                status_code=409,
                detail=f"User already has an active or proposed cycle for skill ID {leg.skill_id}."
            )

        # Course rules: the teacher teaches this course, the learner doesn't,
        # and the teacher is at least two levels above the learner.
        problem = teaching_problem(db, leg.teacher_id, leg.learner_id, leg.skill_id)
        if problem:
            raise HTTPException(
                status_code=400,
                detail=f"Teacher {leg.teacher_id} can't teach skill {leg.skill_id} to learner {leg.learner_id}: {problem}"
            )

    # Create ExchangeGroup
    grp = models.ExchangeGroup(kind="cycle", status="proposed")
    db.add(grp)
    db.flush()

    # Create members
    for uid in member_ids:
        mem = models.ExchangeMember(
            group_id=grp.id,
            user_id=uid,
            accepted=(uid == current_user.id)
        )
        db.add(mem)

    # Create legs (pending)
    for leg in legs_data:
        ex_leg = models.ExchangeLeg(
            group_id=grp.id,
            teacher_id=leg.teacher_id,
            learner_id=leg.learner_id,
            skill_id=leg.skill_id,
            status="pending"
        )
        db.add(ex_leg)

    db.commit()
    db.refresh(grp)

    # Send notifications to other two users
    for uid in member_ids:
        if uid != current_user.id:
            create_notification(
                db=db,
                user_id=uid,
                notification_type="exchange",
                title="Circular Exchange Proposed",
                message=f"{current_user.name} proposed a 3-way circular skill exchange with you.",
                related_id=grp.id,
                related_type="exchange_group"
            )

    return _format_group(grp, db)


@router.post("/{group_id}/respond")
def respond_to_cycle(
    group_id: int,
    payload: RespondCycleRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept or decline an exchange group.
    - When all 3 accept: status -> 'active', create one ConnectionRequest per leg.
    - If anyone declines: status -> 'cancelled', notify all members.
    """
    grp = db.query(models.ExchangeGroup).filter(models.ExchangeGroup.id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Exchange group not found.")

    member = db.query(models.ExchangeMember).filter(
        models.ExchangeMember.group_id == group_id,
        models.ExchangeMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this exchange group.")

    if grp.status != "proposed":
        raise HTTPException(status_code=400, detail=f"Cannot respond to group with status '{grp.status}'.")

    if not payload.accept:
        # Decline: mark group cancelled
        grp.status = "cancelled"
        db.commit()
        # Notify all members
        all_member_ids = [m.user_id for m in grp.members]
        for uid in all_member_ids:
            if uid != current_user.id:
                create_notification(
                    db=db,
                    user_id=uid,
                    notification_type="exchange",
                    title="Circular Exchange Cancelled",
                    message=f"{current_user.name} declined the circular skill exchange.",
                    related_id=grp.id,
                    related_type="exchange_group"
                )
        return {"status": "cancelled", "group_id": grp.id}

    # Member accepts
    member.accepted = True
    db.commit()

    # Check if all members accepted
    all_members = db.query(models.ExchangeMember).filter(models.ExchangeMember.group_id == group_id).all()
    all_accepted = all(m.accepted for m in all_members)

    if all_accepted:
        # Re-check the course rules now (roles can change while a proposal
        # waits) and make sure every learner has the course on their list.
        for leg in grp.legs:
            problem = teaching_problem(db, leg.teacher_id, leg.learner_id, leg.skill_id)
            if problem:
                member.accepted = False
                db.commit()
                raise HTTPException(status_code=400, detail=f"This exchange can't start: {problem}")
            skill_row = db.query(models.Skill).filter(models.Skill.id == leg.skill_id).first()
            if skill_row:
                ensure_learning_course(db, leg.learner_id, skill_row)
        grp.status = "active"
        # Create one connection request per leg and link it
        for leg in grp.legs:
            # Learner requests from Teacher
            skill = db.query(models.Skill).filter(models.Skill.id == leg.skill_id).first()
            skill_name = skill.name if skill else "Skill"
            req = accepted_request_for_leg(
                db, learner_id=leg.learner_id, teacher_id=leg.teacher_id,
                skill_id=leg.skill_id, message=f"3-Way Exchange Circle: {skill_name}",
            )
            leg.request_id = req.id
            leg.status = "active"

        db.commit()

        # Notify all members that the circle is active!
        for m in all_members:
            create_notification(
                db=db,
                user_id=m.user_id,
                notification_type="exchange",
                title="Circular Exchange Active",
                message="All participants accepted! Your 3-way circular skill exchange is now active.",
                related_id=grp.id,
                related_type="exchange_group"
            )

    return _format_group(grp, db)


@router.get("/mine")
def get_my_exchanges(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    List current user's groups with their legs.
    Rule: only members can see a group.
    """
    member_groups = (
        db.query(models.ExchangeGroup)
        .join(models.ExchangeMember)
        .filter(models.ExchangeMember.user_id == current_user.id)
        .order_by(models.ExchangeGroup.created_at.desc())
        .all()
    )
    return [_format_group(g, db) for g in member_groups]
