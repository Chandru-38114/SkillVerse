"""
Chat between two connected people.

ONE conversation per pair of users: if they have several connection requests
(e.g. Python first, Java later), the messages of all of them are shown
together, and the live WebSocket room is per pair ("pair_<low id>_<high id>").

- POST /chat/{request_id}/upload           file or voice note -> Supabase Storage
- GET  /chat/{request_id}/file/{bucket}/{name}   temporary download link
- GET  /chat/inbox                          one row per conversation
- POST /chat/{request_id}/read              mark the partner's messages as read
- GET/POST /chat/{request_id}/messages      history / send (REST fallback)
- WS   /chat/ws/{request_id}                live chat, presence and history
- PUT/DELETE /chat/messages/{id}, POST .../hide, .../react   message actions
"""
import copy
import json
import logging
import re
import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, File, UploadFile
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from ..notification_service import create_notification
from ..supabase_client import signed_url, upload_file
from ..utils.timezone import as_utc, enforce_utc_iso, utc_now
from ..ws_manager import chat_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_VOICE_BYTES = 10 * 1024 * 1024
BLOCKED_FILE_EXTENSIONS = ["exe", "bat", "cmd", "ps1", "sh", "js", "vbs"]  # programs/scripts

@router.post("/{request_id}/upload")
def upload_attachment(
    request_id: int,
    type: str = Query("file"), # "voice" or "file"
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)

    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else ""
    file_bytes = file.file.read()
    size_bytes = len(file_bytes)

    # 1. Safely normalize the MIME type (browser often sends audio/webm;codecs=opus or video/webm for audio)
    raw_content_type = file.content_type or ""
    content_type = raw_content_type.split(";")[0].strip()
    
    if type == "voice":
        if content_type.startswith("video/"):
            content_type = content_type.replace("video/", "audio/")
        elif not content_type:
            content_type = "audio/webm"
    elif type == "file" and not content_type:
        content_type = "application/octet-stream"

    if type == "file":
        if size_bytes > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 25MB)")
        if ext in BLOCKED_FILE_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Executable files are not allowed")
    elif type == "voice":
        if size_bytes > MAX_VOICE_BYTES:
            raise HTTPException(status_code=400, detail="Voice message too large")
        ext = ext or "webm"
    else:
        raise HTTPException(status_code=400, detail="Invalid attachment type")

    filename = f"req_{request_id}_{current_user.id}_{uuid.uuid4().hex}.{ext}"
    bucket = "chat_audio" if type == "voice" else "chat_files"
    upload_file(bucket, filename, file_bytes, content_type)

    metadata = {
        "type": type,
        "mime_type": content_type,
        "size_bytes": size_bytes
    }
    if type == "voice":
        metadata["audio_path"] = filename
    else:
        metadata["file_path"] = filename
        metadata["file_name"] = file.filename

    return {"metadata": metadata}


@router.get("/{request_id}/file/{bucket}/{filename}")
def download_chat_file(
    request_id: int,
    bucket: str,
    filename: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)
    if bucket not in ["chat_audio", "chat_files"]:
        raise HTTPException(status_code=400, detail="Invalid bucket")
    # Files are named req_<request id>_... . A conversation shows messages from
    # every request between the same two people, so the file may belong to an
    # older (possibly completed) request of the pair: allow it if the caller
    # is a participant of THAT request, not only of the conversation's main one.
    m = re.match(r"req_(\d+)_", filename)
    if not m:
        raise HTTPException(status_code=403, detail="Unauthorized access to this file")
    file_request_id = int(m.group(1))
    if file_request_id != request_id:
        file_req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == file_request_id).first()
        if (not file_req or current_user.id not in (file_req.from_user_id, file_req.to_user_id)
                or file_req.status not in ("accepted", "completed")):
            raise HTTPException(status_code=403, detail="Unauthorized access to this file")

    try:
        return {"url": signed_url(bucket, filename)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate signed URL for {bucket}/{filename}: {e}")
        raise HTTPException(status_code=500, detail="Could not generate download link")


def _authorize(db: Session, request_id: int, user_id: int) -> models.ConnectionRequest:
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req or user_id not in (req.from_user_id, req.to_user_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    if req.status != "accepted":
        raise HTTPException(status_code=403, detail="Request has not been accepted yet")
    return req


def _other_user(req: models.ConnectionRequest, user_id: int) -> int:
    """The other person in a request."""
    return req.to_user_id if req.from_user_id == user_id else req.from_user_id


def _room_id(user_a: int, user_b: int) -> str:
    """Live chat room shared by two users (same for both, whatever the order)."""
    return f"pair_{min(user_a, user_b)}_{max(user_a, user_b)}"


def _pair_request_ids(db: Session, user_a: int, user_b: int) -> List[int]:
    """Every connection request between these two users, in either direction."""
    rows = db.query(models.ConnectionRequest.id).filter(
        or_(
            and_(models.ConnectionRequest.from_user_id == user_a, models.ConnectionRequest.to_user_id == user_b),
            and_(models.ConnectionRequest.from_user_id == user_b, models.ConnectionRequest.to_user_id == user_a),
        )
    ).all()
    return [r[0] for r in rows]


def _hidden_message_ids(db: Session, user_id: int):
    """Subquery: messages this user deleted "for me"."""
    return db.query(models.MessageUserState.message_id).filter(
        models.MessageUserState.user_id == user_id
    ).subquery()


def _conversation_messages(db: Session, request_id: int, user_id: int) -> List[models.Message]:
    """The whole conversation of this user with the request's other person,
    oldest first, without messages they hid."""
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    pair_ids = _pair_request_ids(db, user_id, _other_user(req, user_id))
    return db.query(models.Message).filter(
        models.Message.request_id.in_(pair_ids),
        ~models.Message.id.in_(_hidden_message_ids(db, user_id)),
    ).order_by(models.Message.created_at).all()


def _serialize_message(msg: models.Message) -> dict:
    """Shared serializer for WS payloads — keeps history, new messages, and
    update broadcasts consistent."""
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": enforce_utc_iso(msg.created_at),
        "metadata": msg.message_metadata or {},
    }


def _pair_room(db: Session, request_id: int) -> str:
    """Chat room id shared by both participants of a request."""
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req:
        return str(request_id)
    return _room_id(req.from_user_id, req.to_user_id)


async def _broadcast(room_id: str, payload: dict) -> None:
    """Send a live event to everyone in a chat room. Scheduled with FastAPI
    BackgroundTasks from the REST routes: those are sync `def` routes running in
    a worker thread, where asyncio.get_running_loop() fails — which silently
    broke live read receipts, edits, deletes and reactions."""
    try:
        await chat_manager.broadcast(room_id, payload)
    except Exception:
        logger.warning("chat broadcast to %s failed", room_id, exc_info=True)


def _queue_message_update(background_tasks: BackgroundTasks, db: Session, msg: models.Message) -> None:
    # Serialize NOW, while the DB session is open; the task runs after the response.
    background_tasks.add_task(_broadcast, _pair_room(db, msg.request_id),
                              {"type": "message_update", "message": _serialize_message(msg)})


@router.get("/inbox", response_model=List[schemas.InboxConversationOut])
def get_inbox(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch requests where user is either from or to, oldest first
    reqs = db.query(models.ConnectionRequest).filter(
        or_(
            models.ConnectionRequest.from_user_id == current_user.id,
            models.ConnectionRequest.to_user_id == current_user.id
        ),
        models.ConnectionRequest.status.in_(['accepted', 'completed'])
    ).order_by(models.ConnectionRequest.created_at.asc()).all()

    if not reqs:
        return []

    req_ids = [r.id for r in reqs]
    
    # Deduplicate by user pair to enforce ONE conversation per user pair
    canonical_reqs = {}
    pair_req_ids = {}
    req_to_other_user = {}
    
    for req in reqs:
        other_user_id = _other_user(req, current_user.id)
        existing = canonical_reqs.get(other_user_id)
        if existing is None:
            canonical_reqs[other_user_id] = req
            pair_req_ids[other_user_id] = []
        else:
            # Prefer a still-accepted (schedulable) request over a completed one,
            # and among same-status requests prefer the most recently created —
            # otherwise the inbox gets stuck on a stale, already-completed request
            # (and its old skill name) forever, blocking new scheduling.
            e_dt = existing.created_at
            r_dt = req.created_at
            if e_dt and r_dt:
                if e_dt.tzinfo is not None and r_dt.tzinfo is None:
                    e_dt = e_dt.replace(tzinfo=None)
                elif e_dt.tzinfo is None and r_dt.tzinfo is not None:
                    r_dt = r_dt.replace(tzinfo=None)
            existing_rank = (existing.status == "accepted", e_dt, existing.id)
            new_rank = (req.status == "accepted", r_dt, req.id)
            if new_rank > existing_rank:
                canonical_reqs[other_user_id] = req
        pair_req_ids[other_user_id].append(req.id)
        req_to_other_user[req.id] = other_user_id

    other_user_ids = list(canonical_reqs.keys())
    users_map = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(other_user_ids)).all()}
    
    # We map skill_ids just for the canonical request
    canonical_skill_ids = {req.skill_id for req in canonical_reqs.values()}
    skills_map = {s.id: s for s in db.query(models.Skill).filter(models.Skill.id.in_(canonical_skill_ids)).all()}
    
    # Only map sessions that are currently 'scheduled'. Exclude completed or cancelled ones.
    # Sessions can belong to any request ID between the pair.
    sessions_map_pair = {}
    sessions = db.query(models.Session).filter(
        models.Session.request_id.in_(req_ids),
        models.Session.status == "scheduled"
    ).all()
    _now = utc_now()
    # Earliest upcoming one first; skip sessions that already ended without
    # anyone joining, otherwise the chat shows "Join" for an expired session
    # and the Schedule button never comes back.
    sessions = sorted(sessions, key=lambda x: as_utc(x.scheduled_start) or _now)
    for s in sessions:
        end_dt = as_utc(s.scheduled_end)
        if end_dt is not None and end_dt <= _now:
            continue
        other_u_id = req_to_other_user[s.request_id]
        if other_u_id not in sessions_map_pair:
            sessions_map_pair[other_u_id] = s

    hidden_subq = _hidden_message_ids(db, current_user.id)

    # Unread counts map
    unread_counts = db.query(
        models.Message.request_id, func.count(models.Message.id)
    ).filter(
        models.Message.request_id.in_(req_ids),
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False,
        ~models.Message.id.in_(hidden_subq)
    ).group_by(models.Message.request_id).all()
    
    unread_map_pair = {}
    for req_id, count in unread_counts:
        other_u_id = req_to_other_user[req_id]
        unread_map_pair[other_u_id] = unread_map_pair.get(other_u_id, 0) + count

    # Latest messages map
    subq = db.query(
        models.Message.request_id,
        func.max(models.Message.created_at).label('max_dt')
    ).filter(
        models.Message.request_id.in_(req_ids),
        ~models.Message.id.in_(hidden_subq)
    ).group_by(models.Message.request_id).subquery()

    latest_msgs = db.query(models.Message).join(
        subq,
        (models.Message.request_id == subq.c.request_id) &
        (models.Message.created_at == subq.c.max_dt)
    ).all()
    
    latest_msg_map_pair = {}
    for msg in latest_msgs:
        other_u_id = req_to_other_user[msg.request_id]
        if other_u_id not in latest_msg_map_pair:
            latest_msg_map_pair[other_u_id] = msg
        else:
            if msg.created_at > latest_msg_map_pair[other_u_id].created_at:
                latest_msg_map_pair[other_u_id] = msg

    inbox = []
    for other_user_id, req in canonical_reqs.items():
        other_user = users_map.get(other_user_id)
        skill = skills_map.get(req.skill_id)

        latest_msg = latest_msg_map_pair.get(other_user_id)
        unread_count = unread_map_pair.get(other_user_id, 0)
        session = sessions_map_pair.get(other_user_id)

        inbox.append(schemas.InboxConversationOut(
            request_id=req.id,
            other_user_id=other_user.id if other_user else other_user_id,
            other_user_name=other_user.name if other_user else "Unknown",
            other_user_avatar=other_user.profile_picture_url if (other_user and hasattr(other_user, 'profile_picture_url')) else None,
            other_last_active=other_user.last_active if other_user else None,
            skill_name=skill.name if skill else "Unknown",
            latest_message=latest_msg.content if latest_msg else ("Request " + req.status),
            latest_message_time=latest_msg.created_at if latest_msg else req.created_at,
            unread_count=unread_count,
            request_status=req.status,
            session_id=session.id if session else None,
            session_date=session.session_date if session else None,
            session_time=session.start_time if session else None,
            scheduled_start=session.scheduled_start if session else None,
            scheduled_end=session.scheduled_end if session else None,
            request_ids=pair_req_ids.get(other_user_id, [req.id]),
        ))

    # Sort by latest message time descending
    inbox.sort(key=lambda x: x.latest_message_time.timestamp() if x.latest_message_time else 0, reverse=True)
    return inbox

@router.post("/{request_id}/read")
def mark_conversation_read(
    request_id: int,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    req = _authorize(db, request_id, current_user.id)
    other_user_id = _other_user(req, current_user.id)
    pair_req_ids = _pair_request_ids(db, current_user.id, other_user_id)

    unread_messages = db.query(models.Message).filter(
        models.Message.request_id.in_(pair_req_ids),
        models.Message.sender_id == other_user_id,
        models.Message.is_read == False
    ).all()

    if not unread_messages:
        return {"detail": "No unread messages"}

    msg_ids = []
    for msg in unread_messages:
        msg.is_read = True
        msg_ids.append(msg.id)

    db.commit()

    background_tasks.add_task(_broadcast, _room_id(current_user.id, other_user_id), {
        "type": "messages_read",
        "request_id": request_id,
        "reader_id": current_user.id,
        "message_ids": msg_ids,
    })

    return {"detail": "Messages marked as read", "message_ids": msg_ids}

@router.get("/{request_id}/messages", response_model=List[schemas.MessageOut])
def list_messages(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _authorize(db, request_id, current_user.id)
    return _conversation_messages(db, request_id, current_user.id)


@router.post("/{request_id}/messages", response_model=schemas.MessageOut)
def send_message(
    request_id: int,
    payload: schemas.MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _authorize(db, request_id, current_user.id)
    if len(json.dumps(payload.metadata or {}, default=str)) > 8000:
        raise HTTPException(status_code=400, detail="Message details are too large.")
    msg = models.Message(request_id=request_id, sender_id=current_user.id, content=payload.content, message_metadata=payload.metadata or {})
    db.add(msg)
    db.commit()
    db.refresh(msg)
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    create_notification(db, _other_user(req, current_user.id), "message", "New Message", f"{current_user.name} sent you a message", request_id, "chat")
    # Messages sent over REST (forwarding, or while the socket reconnects) must
    # also reach a partner who is online right now.
    background_tasks.add_task(_broadcast, _pair_room(db, request_id), {**_serialize_message(msg), "type": "message"})
    return msg


def _ws_auth_and_authz(token: str, request_id: int):
    """(user, None, other user id) or (None, close code, None)."""
    db = SessionLocal()
    try:
        user = auth.get_user_from_token(token, db)
        if not user:
            return None, 4401, None
        try:
            req = _authorize(db, request_id, user.id)
            return user, None, _other_user(req, user.id)
        except HTTPException:
            return None, 4403, None
    finally:
        db.close()

def _fetch_history(request_id: int, user_id: int):
    db = SessionLocal()
    try:
        return [_serialize_message(m) for m in _conversation_messages(db, request_id, user_id)]
    finally:
        db.close()


def _save_message_and_notify(request_id: int, user_id: int, user_name: str, content: str, metadata: dict = None):
    db_msg = SessionLocal()
    try:
        msg = models.Message(request_id=request_id, sender_id=user_id, content=content, message_metadata=metadata or {})
        db_msg.add(msg)
        db_msg.commit()
        db_msg.refresh(msg)
        req = db_msg.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
        if req:
            create_notification(db_msg, _other_user(req, user_id), "message", "New Message", f"{user_name} sent you a message", request_id, "chat")

        return _serialize_message(msg)
    finally:
        db_msg.close()


@router.websocket("/ws/{request_id}")
async def chat_websocket(websocket: WebSocket, request_id: int, token: str = Query("")):
    await websocket.accept()
    user, error_code, other_user_id = await run_in_threadpool(_ws_auth_and_authz, token, request_id)
    if error_code:
        await websocket.close(code=error_code)
        return

    room_id = _room_id(user.id, other_user_id)
    await chat_manager.connect(room_id, websocket, accept=False)

    try:
        # Broadcast presence online
        await chat_manager.broadcast(room_id, {
            "type": "presence_update",
            "user_id": user.id,
            "status": "online"
        })

        # Tell me if the other user is already online
        if chat_manager.room_size(room_id) > 1:
            await websocket.send_json({
                "type": "presence_update",
                "user_id": other_user_id,
                "status": "online"
            })

        # Send history immediately upon connection
        hist_messages = await run_in_threadpool(_fetch_history, request_id, user.id)
        await websocket.send_json({"type": "history", "messages": hist_messages})

        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if not isinstance(data, dict):
                continue
            content = data.get("content") or ""
            content = content.strip() if isinstance(content, str) else ""
            metadata = data.get("metadata") or {}
            # Same limits as the REST route: no giant messages or metadata blobs.
            if not isinstance(metadata, dict) or len(content) > 5000 or len(json.dumps(metadata, default=str)) > 8000:
                continue
            if not content and not metadata:
                continue

            msg_payload = await run_in_threadpool(_save_message_and_notify, request_id, user.id, user.name, content, metadata)
            msg_payload["type"] = "message"
            await chat_manager.broadcast(room_id, msg_payload)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Chat websocket error (request_id=%s, user_id=%s)", request_id, user.id)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        chat_manager.disconnect(room_id, websocket)
        try:
            last_active_iso = await run_in_threadpool(_update_last_active, user.id)
            await chat_manager.broadcast(room_id, {
                "type": "presence_update",
                "user_id": user.id,
                "status": "offline",
                "last_active": last_active_iso
            })
        except Exception:
            logger.exception("Error broadcasting offline presence")


def _update_last_active(user_id: int) -> str:
    db = SessionLocal()
    try:
        now = utc_now()
        db.query(models.User).filter(models.User.id == user_id).update({"last_active": now})
        db.commit()
        return enforce_utc_iso(now)
    finally:
        db.close()


# ── Message operations ────────────────────────────────────────────────────────

def _get_message_authorized(db: Session, message_id: int, user_id: int) -> models.Message:
    """Fetch message and verify user belongs to the conversation."""
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    _authorize(db, msg.request_id, user_id)
    return msg


@router.put("/messages/{message_id}", response_model=schemas.MessageOut)
def edit_message(
    message_id: int,
    payload: schemas.MessageEdit,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    msg = _get_message_authorized(db, message_id, current_user.id)
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can edit this message")
    if (msg.message_metadata or {}).get("deleted_for_everyone"):
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    new_meta = dict(msg.message_metadata or {})
    new_meta["edited_at"] = utc_now().isoformat()
    msg.content = payload.content
    msg.message_metadata = new_meta
    db.commit()
    db.refresh(msg)

    # Broadcast real-time update to both participants
    _queue_message_update(background_tasks, db, msg)
    return msg


@router.delete("/messages/{message_id}")
def delete_message_for_everyone(
    message_id: int,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    msg = _get_message_authorized(db, message_id, current_user.id)
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can delete this message for everyone")

    request_id = msg.request_id
    new_meta = dict(msg.message_metadata or {})
    new_meta["deleted_for_everyone"] = True
    msg.content = ""
    msg.message_metadata = new_meta
    db.commit()
    db.refresh(msg)

    # Broadcast real-time update to both participants
    _queue_message_update(background_tasks, db, msg)
    return {"detail": "Message deleted", "id": message_id, "request_id": request_id}


@router.post("/messages/{message_id}/hide")
def delete_message_for_me(
    message_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _get_message_authorized(db, message_id, current_user.id)  # 404/403 if not allowed
    existing = db.query(models.MessageUserState).filter(
        models.MessageUserState.message_id == message_id,
        models.MessageUserState.user_id == current_user.id
    ).first()
    
    if not existing:
        state = models.MessageUserState(message_id=message_id, user_id=current_user.id)
        db.add(state)
        db.commit()
        
    return {"detail": "Message hidden successfully", "id": message_id}


@router.post("/messages/{message_id}/react")
def toggle_reaction(
    message_id: int,
    payload: schemas.ReactionUpdate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    msg = _get_message_authorized(db, message_id, current_user.id)
    # Deep copy: a shallow copy shares the inner lists with the value SQLAlchemy
    # remembers, so removing a reaction left old == new and nothing was saved.
    new_meta = copy.deepcopy(msg.message_metadata or {})
    reactions = new_meta.get("reactions", {})

    emoji = payload.emoji
    user_id = current_user.id

    if emoji not in reactions:
        reactions[emoji] = []

    if user_id in reactions[emoji]:
        reactions[emoji].remove(user_id)
        if not reactions[emoji]:
            del reactions[emoji]
    else:
        # Prevent duplicate user IDs
        if user_id not in reactions.get(emoji, []):
            reactions[emoji] = reactions.get(emoji, []) + [user_id]

    new_meta["reactions"] = reactions
    msg.message_metadata = new_meta
    db.commit()
    db.refresh(msg)

    # Broadcast real-time update to both participants
    _queue_message_update(background_tasks, db, msg)
    return {
        "id": msg.id,
        "request_id": msg.request_id,
        "metadata": msg.message_metadata,
    }

