from typing import Optional
"""
Sessions router — scheduling a learning session for an accepted connection.

Endpoints:
  POST   /sessions              Create a session for an accepted request
  GET    /sessions/upcoming     My upcoming (scheduled, future) sessions
  GET    /sessions/my           All my sessions (any status)
  GET    /sessions/{id}         Single session by id
  PUT    /sessions/{id}         Reschedule (date/time/notes)
  POST   /sessions/{id}/cancel  Cancel a scheduled session
"""
import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session as DBSession
from ..notification_service import create_notification
from jose import jwt, JWTError

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from .requests import _to_out as _req_to_out
from ..ws_manager import webrtc_manager

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _authenticate_ws(token: str, db: DBSession) -> Optional[models.User]:
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.query(models.User).filter(models.User.id == int(user_id)).first()

# ── helpers ──────────────────────────────────────────────────────────────────

def _to_out(s: models.Session) -> schemas.SessionOut:
    return schemas.SessionOut(
        id=s.id,
        request_id=s.request_id,
        tutor_id=s.tutor_id,
        tutor_name=s.tutor.name,
        learner_id=s.learner_id,
        learner_name=s.learner.name,
        skill=s.skill,
        session_date=s.session_date,
        start_time=s.start_time,
        end_time=s.end_time,
        scheduled_start=s.scheduled_start,
        scheduled_end=s.scheduled_end,
        status=s.status,
        notes=s.notes,
        request=_req_to_out(s.request) if s.request else None,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )



def _validate_times(start: dt.datetime, end: dt.datetime):
    """Raise 422 for obviously invalid date/time combinations."""
    if start >= end:
        raise HTTPException(status_code=422, detail="Start time must be before end time.")
    from ..utils.timezone import utc_now
    # We allow scheduling slightly in the past (e.g. starting a session right now)
    if start < utc_now() - dt.timedelta(hours=1):
        raise HTTPException(status_code=422, detail="Session cannot be scheduled too far in the past.")



def _get_my_session(session_id: int, current_user: models.User, db: DBSession) -> models.Session:
    """Fetch a session and verify the caller is a participant."""
    s = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not s or current_user.id not in (s.tutor_id, s.learner_id):
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Enforce expiration logic on the backend
    try:
        from ..utils.timezone import utc_now
        end_dt = s.scheduled_end
        if end_dt and utc_now() >= end_dt:
            if s.status not in ('completed', 'cancelled'):
                s.status = 'completed'
                db.commit()
            raise HTTPException(status_code=410, detail="This session has expired.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        pass # ignore parsing errors from bad data
        
    return s


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=schemas.SessionOut)
def create_session(
    payload: schemas.SessionCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Schedule a session for an ACCEPTED connection request.

    Validations:
    - request must exist and be accepted
    - caller must be one of the two participants
    - no other active (scheduled) session may exist for the same request
      (to reschedule, cancel the existing one first)
    - date/time must be valid
    """
    req = db.query(models.ConnectionRequest).filter(
        models.ConnectionRequest.id == payload.request_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Connection request not found.")

    if current_user.id not in (req.from_user_id, req.to_user_id):
        raise HTTPException(status_code=403, detail="You are not a participant of this request.")

    if req.status != "accepted":
        raise HTTPException(
            status_code=400,
            detail=f"Sessions can only be created for accepted requests (current status: {req.status}).",
        )

    # Prevent duplicate active sessions
    existing_active = (
        db.query(models.Session)
        .filter(
            models.Session.request_id == payload.request_id,
            models.Session.status == "scheduled",
        )
        .first()
    )
    if existing_active:
        raise HTTPException(
            status_code=409,
            detail="An active session is already scheduled for this request. Cancel it first to reschedule.",
        )

    _validate_times(payload.scheduled_start, payload.scheduled_end)
    
    # Store legacy strings based on scheduled_start for backward compatibility until dropped
    from ..utils.timezone import IST
    ist_start = payload.scheduled_start.astimezone(IST)
    ist_end = payload.scheduled_end.astimezone(IST)
    
    session = models.Session(
        request_id=payload.request_id,
        tutor_id=req.to_user_id,
        learner_id=req.from_user_id,
        skill=req.skill.name,
        session_date=ist_start.strftime("%Y-%m-%d"),
        start_time=ist_start.strftime("%H:%M"),
        end_time=ist_end.strftime("%H:%M"),
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    to_notify = session.learner_id if current_user.id == session.tutor_id else session.tutor_id
    create_notification(db, to_notify, "session", "Session Scheduled", f"{current_user.name} scheduled a new session", session.id, "session")
    return _to_out(session)


@router.get("/upcoming", response_model=List[schemas.SessionOut])
def upcoming_sessions(
    current_user: models.User = Depends(auth.get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return my scheduled sessions whose date is today or in the future."""
    today = dt.date.today().isoformat()
    rows = (
        db.query(models.Session)
        .filter(
            models.Session.status == "scheduled",
            models.Session.scheduled_start >= utc_now() - dt.timedelta(hours=24),
            (models.Session.tutor_id == current_user.id)
            | (models.Session.learner_id == current_user.id),
        )
        .order_by(models.Session.scheduled_start)
        .all()
    )
    return [_to_out(s) for s in rows]


@router.get("/my", response_model=List[schemas.SessionOut])
def my_sessions(
    current_user: models.User = Depends(auth.get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return all my sessions (any status), newest first."""
    rows = (
        db.query(models.Session)
        .filter(
            (models.Session.tutor_id == current_user.id)
            | (models.Session.learner_id == current_user.id)
        )
        .order_by(models.Session.scheduled_start.desc())
        .all()
    )
    return [_to_out(s) for s in rows]


@router.get("/{session_id}", response_model=schemas.SessionOut)
def get_session(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: DBSession = Depends(get_db),
):
    return _to_out(_get_my_session(session_id, current_user, db))


@router.put("/{session_id}", response_model=schemas.SessionOut)
def update_session(
    session_id: int,
    payload: schemas.SessionUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: DBSession = Depends(get_db),
):
    """Reschedule a session (date, time, notes). Only works when status is 'scheduled'."""
    s = _get_my_session(session_id, current_user, db)

    if s.status != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update a session with status '{s.status}'.",
        )

    from ..utils.timezone import IST
    s.scheduled_start = payload.scheduled_start or s.scheduled_start
    s.scheduled_end = payload.scheduled_end or s.scheduled_end
    _validate_times(s.scheduled_start, s.scheduled_end)
    
    ist_start = s.scheduled_start.astimezone(IST)
    ist_end = s.scheduled_end.astimezone(IST)
    s.session_date = ist_start.strftime("%Y-%m-%d")
    s.start_time = ist_start.strftime("%H:%M")
    s.end_time = ist_end.strftime("%H:%M")
    if payload.notes is not None:
        s.notes = payload.notes

    db.commit()
    db.refresh(s)
    to_notify = s.learner_id if current_user.id == s.tutor_id else s.tutor_id
    create_notification(db, to_notify, "session", "Session Rescheduled", f"{current_user.name} rescheduled the session", s.id, "session")
    return _to_out(s)


@router.post("/{session_id}/cancel", response_model=schemas.SessionOut)
def cancel_session(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: DBSession = Depends(get_db),
):
    """Cancel a scheduled session. Cannot cancel completed sessions."""
    s = _get_my_session(session_id, current_user, db)

    if s.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed session.")
    if s.status == "cancelled":
        raise HTTPException(status_code=400, detail="Session is already cancelled.")

    s.status = "cancelled"
    db.commit()
    db.refresh(s)
    to_notify = s.learner_id if current_user.id == s.tutor_id else s.tutor_id
    create_notification(db, to_notify, "session", "Session Cancelled", f"{current_user.name} cancelled the session", s.id, "session")
    return _to_out(s)
@router.websocket("/ws/{session_id}")
async def webrtc_signaling(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(...)
):
    db = SessionLocal()
    try:
        user = _authenticate_ws(token, db)
        if not user:
            await websocket.close(code=1008)
            return
        
        s = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not s or user.id not in (s.tutor_id, s.learner_id):
            await websocket.close(code=1008)
            return
            
        if s.status != "scheduled":
            await websocket.close(code=1008)
            return

        import asyncio
        from ..utils.timezone import utc_now
        end_dt = s.scheduled_end
        if end_dt and utc_now() >= end_dt:
            s.status = "completed"
            db.commit()
            await websocket.close(code=1008, reason="Session Ended")
            return
    finally:
        db.close()

    # Connect user
    await webrtc_manager.connect(session_id, user.id, websocket)

    # Notify peer that user joined
    await webrtc_manager.send_to_peer(session_id, user.id, {
        "type": "peer_joined",
        "user_id": user.id
    })

    async def enforce_end():
        while True:
            now = utc_now()
            if now >= end_dt:
                db_end = SessionLocal()
                try:
                    s_end = db_end.query(models.Session).filter(models.Session.id == session_id).first()
                    if s_end and s_end.status != "completed":
                        s_end.status = "completed"
                        db_end.commit()
                finally:
                    db_end.close()
                try:
                    await websocket.close(code=1008, reason="Session Ended")
                except Exception:
                    pass
                break
            await asyncio.sleep(min(max((end_dt - now).total_seconds(), 0.1), 10))

    enforcer = asyncio.create_task(enforce_end())

    try:
        while True:
            data = await websocket.receive_json()
            # For WebRTC, just relay to the other participant
            await webrtc_manager.send_to_peer(session_id, user.id, data)
    except WebSocketDisconnect:
        pass
    finally:
        enforcer.cancel()
        webrtc_manager.disconnect(session_id, user.id)
        # Try to notify peer if still possible
        asyncio.create_task(webrtc_manager.send_to_peer(session_id, user.id, {
            "type": "peer_left",
            "user_id": user.id
        }))
