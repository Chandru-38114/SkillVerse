from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=List[schemas.NotificationOut])
def get_notifications(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(desc(models.Notification.created_at)).all()
    return notifs

@router.get("/unread-count")
def get_unread_count(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()
    return {"unread_count": count}

@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    notif.is_read = True
    db.commit()
    return {"detail": "Marked read"}

@router.post("/read-all")
def mark_all_read(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).all()
    
    for n in notifs:
        n.is_read = True
    db.commit()
    return {"detail": "All marked read"}
