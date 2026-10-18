"""The check almost every Learning Arena route needs: "load this session and
make sure the caller is its tutor or learner"."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models


def is_participant(session: models.Session, user_id: int) -> bool:
    return user_id in (session.tutor_id, session.learner_id)


def get_session_for_participant(
    db: Session, session_id: int, user_id: int, forbidden_detail: str = "Not authorized"
) -> models.Session:
    """The session, or 404 if it doesn't exist / 403 if the user isn't in it."""
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not is_participant(session, user_id):
        raise HTTPException(status_code=403, detail=forbidden_detail)
    return session
