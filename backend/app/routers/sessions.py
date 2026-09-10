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
from sqlalchemy.orm import Session
from ..notification_service import create_notification as DBSession
from jose import jwt, JWTError

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from .requests import _to_out as _req_to_out
from ..ws_manager import webrtc_manager

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _authenticate_ws(token: str, db: DBSession) -> models.User | None:
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
        status=s.status,
        notes=s.notes,
        request=_req_to_out(s.request) if s.request else None,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )



def _validate_times(session_date: str, start_time: str, end_time: str):
    """Raise 422 for obviously invalid date/time combinations."""
    try:
        date_obj  = dt.date.fromisoformat(session_date)
        start_obj = dt.time.fromisoformat(start_time)
        end_obj   = dt.time.fromisoformat(end_time)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid date or time format: {exc}")

    if end_obj <= start_obj:
        raise HTTPException(status_code=422, detail="end_time must be after start_time.")

    # Prevent scheduling in the past (by date — lenient about same-day)
    if date_obj < dt.date.today():
        raise HTTPException(status_code=422, detail="session_date cannot be in the past.")


def _get_my_session(session_id: int, current_user: models.User, db: DBSession) -> models.Session:
    """Fetch a session and verify the caller is a participant."""
    s = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not s or current_user.id not in (s.tutor_id, s.learner_id):
        raise HTTPException(status_code=404, detail="Session not found.")
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

    _validate_times(payload.session_date, payload.start_time, payload.end_time)

    # tutor = the person who received the request (to_user); learner = sender (from_user)
    session = models.Session(
        request_id=payload.request_id,
        tutor_id=req.to_user_id,
        learner_id=req.from_user_id,
        skill=req.skill.name,
        session_date=payload.session_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
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
            models.Session.session_date >= today,
            (models.Session.tutor_id == current_user.id)
            | (models.Session.learner_id == current_user.id),
        )
        .order_by(models.Session.session_date, models.Session.start_time)
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
        .order_by(models.Session.session_date.desc(), models.Session.start_time.desc())
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

    new_date  = payload.session_date or s.session_date
    new_start = payload.start_time   or s.start_time
    new_end   = payload.end_time     or s.end_time

    _validate_times(new_date, new_start, new_end)

    s.session_date = new_date
    s.start_time   = new_start
    s.end_time     = new_end
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
        
        # Verify session and participant
        s = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not s or user.id not in (s.tutor_id, s.learner_id):
            await websocket.close(code=1008)
            return
            
        if s.status != "scheduled":
            await websocket.close(code=1008)
            return

        # Connect user
        await webrtc_manager.connect(session_id, user.id, websocket)

        # Notify peer that user joined
        await webrtc_manager.send_to_peer(session_id, user.id, {
            "type": "peer_joined",
            "user_id": user.id
        })

        try:
            while True:
                data = await websocket.receive_json()
                # For WebRTC, just relay to the other participant
                await webrtc_manager.send_to_peer(session_id, user.id, data)
        except WebSocketDisconnect:
            webrtc_manager.disconnect(session_id, user.id)
            await webrtc_manager.send_to_peer(session_id, user.id, {
                "type": "peer_left",
                "user_id": user.id
            })

    finally:
        db.close()
