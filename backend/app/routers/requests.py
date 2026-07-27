from typing import List
from fastapi import APIRouter, Depends, HTTPException
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


@router.post("", response_model=schemas.ConnectionRequestOut)
def create_request(
    payload: schemas.ConnectionRequestCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    skill = get_or_create_skill(db, payload.skill_name)
    req = models.ConnectionRequest(
        from_user_id=current_user.id, to_user_id=payload.to_user_id,
        skill_id=skill.id, message=payload.message or "",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _to_out(req)


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