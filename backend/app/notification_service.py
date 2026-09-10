from sqlalchemy.orm import Session
from . import models

def create_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    related_id: int = None,
    related_type: str = None
):
    """
    Helper to create a notification in the database.
    """
    notif = models.Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        related_id=related_id,
        related_type=related_type
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
