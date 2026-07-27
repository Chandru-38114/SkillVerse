from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/chat", tags=["chat"])


def _authorize(db: Session, request_id: int, user_id: int) -> models.ConnectionRequest:
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req or user_id not in (req.from_user_id, req.to_user_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    if req.status != "accepted":
        raise HTTPException(status_code=403, detail="Request has not been accepted yet")
    return req


@router.get("/{request_id}/messages", response_model=List[schemas.MessageOut])
def list_messages(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _authorize(db, request_id, current_user.id)
    rows = db.query(models.Message).filter(models.Message.request_id == request_id).order_by(models.Message.created_at).all()
    return rows


@router.post("/{request_id}/messages", response_model=schemas.MessageOut)
def send_message(
    request_id: int,
    payload: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _authorize(db, request_id, current_user.id)
    msg = models.Message(request_id=request_id, sender_id=current_user.id, content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg