from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from .users import get_or_create_skill

router = APIRouter(prefix="/requests", tags=["requests"])


def _to_out(r: models.ConnectionRequest) -> schemas.ConnectionRequestOut:
    return schemas.ConnectionRequestOut(
        id=r.id, from_user_id=r.from_user_id, from_user_name=r.from_user.name,
        to_user_id=r.to_user_id, to_user_name=r.to_user.name,
        skill_name=r.skill.name, message=r.message, status=r.status,
        created_at=r.created_at,
    )


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
    )
    db.add(req)
    db.commit()
    db.refresh(req)
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

    req.status = "accepted" if accept else "declined"
    db.commit()
    db.refresh(req)
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

    req.status = "completed"

    # Award +20 points to both participants.
    # This block is only reachable when status was 'accepted' (all other
    # paths are rejected above), so double-rewarding is impossible.
    learner = db.query(models.User).filter(models.User.id == req.from_user_id).first()
    teacher = db.query(models.User).filter(models.User.id == req.to_user_id).first()
    if learner:
        learner.points += 20
    if teacher:
        teacher.points += 20

    db.commit()
    db.refresh(req)
    return _to_out(req)