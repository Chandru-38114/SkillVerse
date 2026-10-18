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
import os
import requests


from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from starlette.concurrency import run_in_threadpool
from sqlalchemy import or_
from sqlalchemy.orm import Session as DBSession
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from .requests import _to_out as _req_to_out
from ..ws_manager import webrtc_manager
from ..utils.timezone import utc_now, IST

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.get("/turn-credentials")
def get_turn_credentials(current_user: models.User = Depends(auth.get_current_user)):
    """Fetch time-limited TURN credentials securely from backend variables."""
    metered_domain = os.environ.get("METERED_DOMAIN")
    metered_api_key = os.environ.get("METERED_API_KEY")
    
    if not metered_domain or not metered_api_key:
        print("[TURN] Backend metered config missing, returning empty array")
        return {"iceServers": []}
        
    url = f"https://{metered_domain}/api/v1/turn/credentials?apiKey={metered_api_key}"
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return {"iceServers": resp.json()}
    except Exception as e:
        print(f"[TURN] Failed to fetch credentials from Metered: {e}")
        return {"iceServers": []}




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



MIN_SESSION_MINUTES = 15
MAX_SESSION_MINUTES = 180
# The room opens this many minutes before the scheduled start.
EARLY_JOIN_MINUTES = 15


def _utc(d: Optional[dt.datetime]) -> Optional[dt.datetime]:
    """SQLite returns naive datetimes (stored as UTC); make every value aware."""
    if d is None:
        return None
    return d.replace(tzinfo=dt.timezone.utc) if d.tzinfo is None else d.astimezone(dt.timezone.utc)


def _validate_times(start: dt.datetime, end: dt.datetime):
    """Raise 422 for invalid date/time combinations."""
    start, end = _utc(start), _utc(end)
    if start >= end:
        raise HTTPException(status_code=422, detail="Start time must be before end time.")
    minutes = (end - start).total_seconds() / 60
    if minutes < MIN_SESSION_MINUTES:
        raise HTTPException(status_code=422, detail=f"A session must be at least {MIN_SESSION_MINUTES} minutes long.")
    if minutes > MAX_SESSION_MINUTES:
        raise HTTPException(status_code=422, detail=f"A session can be at most {MAX_SESSION_MINUTES // 60} hours long.")
    # We allow scheduling slightly in the past (e.g. starting a session right now)
    if start < utc_now() - dt.timedelta(hours=1):
        raise HTTPException(status_code=422, detail="Session cannot be scheduled too far in the past.")
    if start > utc_now() + dt.timedelta(days=60):
        raise HTTPException(status_code=422, detail="Sessions can be scheduled at most 60 days ahead.")


def _check_overlap(db: DBSession, people, new_start: dt.datetime, new_end: dt.datetime,
                   current_user_id: int, ignore_session_id: Optional[int] = None):
    """Neither person may already have another scheduled session that overlaps
    this time (e.g. a tutor booked by two different learners at 5–6 PM)."""
    new_start, new_end = _utc(new_start), _utc(new_end)
    others = (
        db.query(models.Session)
        .filter(
            models.Session.status == "scheduled",
            or_(models.Session.tutor_id.in_(people), models.Session.learner_id.in_(people)),
        )
        .all()
    )
    for other in others:
        if other.id == ignore_session_id or not other.scheduled_start or not other.scheduled_end:
            continue
        if _utc(other.scheduled_start) < new_end and _utc(other.scheduled_end) > new_start:
            who = "You already have" if current_user_id in (other.tutor_id, other.learner_id) else "Your partner already has"
            raise HTTPException(
                status_code=409,
                detail=f"{who} a session from {_utc(other.scheduled_start).astimezone(IST).strftime('%d %b %I:%M %p')} "
                       f"to {_utc(other.scheduled_end).astimezone(IST).strftime('%I:%M %p')} IST. Pick a different time.",
            )


def _expire_if_over(s: models.Session, db: DBSession) -> bool:
    """A scheduled session past its end: completed if BOTH people were in the
    room, otherwise it stays "scheduled" and the UI shows it as missed.
    Returns True when the session is over."""
    end_dt = _utc(s.scheduled_end)
    if s.status != "scheduled" or end_dt is None or utc_now() < end_dt:
        return False
    if s.both_joined_at is not None:
        s.status = "completed"
        db.commit()
    return True



def _get_my_session(session_id: int, current_user: models.User, db: DBSession) -> models.Session:
    """Fetch a session and verify the caller is a participant."""
    s = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not s or current_user.id not in (s.tutor_id, s.learner_id):
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Expiry rules:
    # - completed / cancelled sessions are always readable (the post-session
    #   review page needs them long after the end time);
    # - a scheduled session past its end that someone joined is completed;
    # - one that nobody joined was missed: it stays "scheduled" (the UI shows
    #   it as Missed) and the room can't be entered any more (410).
    if _expire_if_over(s, db) and s.status == "scheduled":
        raise HTTPException(status_code=410, detail="This session was missed — you both needed to join before it ended.")

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

    # Prevent duplicate active sessions. A "scheduled" session whose end time
    # has already passed (nobody joined, so it was never closed) must not block
    # scheduling a new one.
    now_utc = utc_now()
    existing_active = None
    for s_old in (
        db.query(models.Session)
        .filter(
            models.Session.request_id == payload.request_id,
            models.Session.status == "scheduled",
        )
        .all()
    ):
        old_end = s_old.scheduled_end
        if old_end is not None and old_end.tzinfo is None:
            old_end = old_end.replace(tzinfo=dt.timezone.utc)
        if old_end is None or old_end > now_utc:
            existing_active = s_old
            break
    if existing_active:
        raise HTTPException(
            status_code=409,
            detail="An active session is already scheduled for this request. Cancel it first to reschedule.",
        )

    _validate_times(payload.scheduled_start, payload.scheduled_end)
    _check_overlap(db, (req.from_user_id, req.to_user_id), payload.scheduled_start, payload.scheduled_end, current_user.id)

    # Store legacy strings based on scheduled_start for backward compatibility until dropped
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
    """Return my scheduled sessions whose date is today or in the future and haven't ended."""
    now = utc_now()
    rows = (
        db.query(models.Session)
        .filter(
            models.Session.status == "scheduled",
            (models.Session.tutor_id == current_user.id)
            | (models.Session.learner_id == current_user.id),
        )
        .order_by(models.Session.scheduled_start)
        .all()
    )
    
    # Filter out sessions that have already ended (or started > 2 hours ago if no end time)
    valid_rows = []
    for s in rows:
        end_dt = s.scheduled_end
        if end_dt and end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=dt.timezone.utc)
            
        start_dt = s.scheduled_start
        if start_dt and start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=dt.timezone.utc)
            
        if end_dt and end_dt > now:
            valid_rows.append(s)
        elif not end_dt and start_dt and start_dt > now - dt.timedelta(hours=2):
            valid_rows.append(s)
            
    return [_to_out(s) for s in valid_rows]


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
    # Once someone has joined, the times are fixed (moving the end time of a
    # running session would stretch it, or hide that it was missed).
    if s.started_at is not None and (payload.scheduled_start or payload.scheduled_end):
        raise HTTPException(status_code=400, detail="This session has already started, so its time can't be changed.")

    new_start = _utc(payload.scheduled_start or s.scheduled_start)
    new_end = _utc(payload.scheduled_end or s.scheduled_end)
    if payload.scheduled_start or payload.scheduled_end:
        _validate_times(new_start, new_end)
        _check_overlap(db, (s.tutor_id, s.learner_id), new_start, new_end, current_user.id, ignore_session_id=s.id)
    s.scheduled_start, s.scheduled_end = new_start, new_end

    ist_start = new_start.astimezone(IST)
    ist_end = new_end.astimezone(IST)
    s.session_date = ist_start.strftime("%Y-%m-%d")
    s.start_time = ist_start.strftime("%H:%M")
    s.end_time = ist_end.strftime("%H:%M")
    if payload.notes is not None:
        s.notes = payload.notes[:1000]

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
    if s.both_joined_at is not None:
        raise HTTPException(status_code=400, detail="You both already joined this session, so it can't be cancelled. Complete it instead.")
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
    # Accept FIRST, then authenticate and close with a specific code
    # (CLAUDE.md rule): closing before accept makes the browser see a generic
    # 1006 and retry forever instead of showing "session ended".
    await websocket.accept()
    db = SessionLocal()
    try:
        user = auth.get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4401, reason="Not signed in")
            return

        s = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not s or user.id not in (s.tutor_id, s.learner_id):
            await websocket.close(code=4403, reason="Not a participant")
            return
        # Read the id now: committing below expires ORM objects, and the
        # session is closed before they're used again.
        user_id = user.id

        if s.status != "scheduled":
            await websocket.close(code=4410, reason="Session Ended")
            return

        import asyncio
        end_dt = _utc(s.scheduled_end)
        if _expire_if_over(s, db):
            await websocket.close(code=4410, reason="Session Ended")
            return

        # The room opens EARLY_JOIN_MINUTES before the start. Joining earlier
        # used to mark the session as started hours ahead.
        start_dt = _utc(s.scheduled_start)
        if start_dt and utc_now() < start_dt - dt.timedelta(minutes=EARLY_JOIN_MINUTES):
            await websocket.close(code=4425, reason="Too early")
            return

        # First participant to connect marks the session as started.
        if s.started_at is None:
            s.started_at = utc_now()
            db.commit()
        tutor_id, learner_id = s.tutor_id, s.learner_id
    finally:
        db.close()

    # Connect user (already accepted above)
    await webrtc_manager.connect(session_id, user_id, websocket, accept=False)

    # When tutor AND learner are both in the room, remember it: only such a
    # session counts as held (and can be completed).
    room = webrtc_manager.rooms.get(session_id, {})
    if tutor_id in room and learner_id in room:
        def _mark_both_joined():
            db2 = SessionLocal()
            try:
                db2.query(models.Session).filter(
                    models.Session.id == session_id, models.Session.both_joined_at.is_(None),
                ).update({models.Session.both_joined_at: utc_now()}, synchronize_session=False)
                db2.commit()
            finally:
                db2.close()
        await run_in_threadpool(_mark_both_joined)

    # Notify peer that user joined
    await webrtc_manager.send_to_peer(session_id, user_id, {
        "type": "peer_joined",
        "user_id": user_id
    })

    async def enforce_end():
        if not end_dt:
            return
        while True:
            now = utc_now()
            if now >= end_dt:
                db_end = SessionLocal()
                try:
                    s_end = db_end.query(models.Session).filter(models.Session.id == session_id).first()
                    # Never turn a cancelled session into a completed one, and
                    # only a session both people joined counts as held.
                    if s_end and s_end.status == "scheduled" and s_end.both_joined_at is not None:
                        s_end.status = "completed"
                        db_end.commit()
                finally:
                    db_end.close()
                try:
                    await websocket.close(code=4410, reason="Session Ended")
                except Exception:
                    pass
                break
            await asyncio.sleep(min(max((end_dt - now).total_seconds(), 0.1), 10))

    enforcer = asyncio.create_task(enforce_end())

    try:
        while True:
            data = await websocket.receive_json()
            if not isinstance(data, dict) or data.get("type") == "ping":
                continue
            # For WebRTC, just relay to the other participant
            await webrtc_manager.send_to_peer(session_id, user_id, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        # Bad JSON or a dead socket: clean up below instead of leaving a
        # stale entry in the room.
        pass
    finally:
        enforcer.cancel()
        replaced = webrtc_manager.rooms.get(session_id, {}).get(user_id) not in (None, websocket)
        webrtc_manager.disconnect(session_id, user_id, websocket)
        # Try to notify peer if still possible (not when this was an old
        # socket of a user who has already reconnected).
        if not replaced:
            asyncio.create_task(webrtc_manager.send_to_peer(session_id, user_id, {
                "type": "peer_disconnected",
                "userId": user_id
            }))
