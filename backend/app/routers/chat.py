from typing import List, Optional
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, File, UploadFile
import uuid
import mimetypes
from fastapi.responses import RedirectResponse
from starlette.concurrency import run_in_threadpool
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from ..notification_service import create_notification
from ..utils.timezone import enforce_utc_iso
from ..supabase_client import get_supabase

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from ..ws_manager import chat_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

ALLOWED_EXTENSIONS = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "txt": "text/plain",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

@router.post("/{request_id}/upload")
async def upload_attachment(
    request_id: int,
    type: str = Query("file"), # "voice" or "file"
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)

    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else ""
    file_bytes = await file.read()
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
        if size_bytes > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 25MB)")
        if ext in ["exe", "bat", "cmd", "ps1", "sh", "js", "vbs"]:
            raise HTTPException(status_code=400, detail="Executable files are not allowed")
    elif type == "voice":
        if size_bytes > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Voice message too large")
        ext = ext or "webm"
    else:
        raise HTTPException(status_code=400, detail="Invalid attachment type")

    filename = f"req_{request_id}_{current_user.id}_{uuid.uuid4().hex}.{ext}"
    bucket = "chat_audio" if type == "voice" else "chat_files"
    supabase = get_supabase()

    try:
        logger.info(f"Uploading to bucket '{bucket}', path '{filename}', content-type '{content_type}' (raw: {raw_content_type})")
        res = supabase.storage.from_(bucket).upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": content_type}
        )
        
        if isinstance(res, dict):
            status = res.get("statusCode", res.get("status", 200))
            if res.get("error") or status >= 400:
                msg = res.get("message", res.get("error", "Upload failed"))
                logger.error(f"Storage upload dict error (Bucket: {bucket}, Path: {filename}): HTTP {status} - {msg}")
                raise HTTPException(status_code=status if isinstance(status, int) else 500, detail=f"Storage upload failed (HTTP {status}): {msg}")
        elif hasattr(res, "status_code") and res.status_code >= 400:
            err = res.json() if hasattr(res, "json") else {}
            msg = err.get("message", err.get("error", "Upload failed"))
            logger.error(f"Storage upload response error (Bucket: {bucket}, Path: {filename}): HTTP {res.status_code} - {msg}")
            raise HTTPException(status_code=res.status_code, detail=f"Storage upload failed (HTTP {res.status_code}): {msg}")
            
    except HTTPException:
        raise
    except Exception as e:
        # If the SDK throws an exception (like the text AttributeError), fallback to a reliable REST upload
        logger.warning(f"Storage SDK upload failed (Bucket: {bucket}, Path: {filename}): {str(e)}. Attempting REST fallback...")
        import requests
        from ..supabase_client import SUPABASE_URL, SUPABASE_KEY
        
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Storage configuration missing for fallback.")
            
        from urllib.parse import urlparse
        parsed = urlparse(SUPABASE_URL)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        url = f"{base_url}/storage/v1/object/{bucket}/{filename}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": content_type
        }
        
        try:
            resp = requests.post(url, data=file_bytes, headers=headers, timeout=30)
            if resp.status_code >= 400:
                err_dict = resp.json() if resp.text else {}
                msg = err_dict.get("message", err_dict.get("error", resp.text or "REST Upload failed"))
                logger.error(f"REST fallback upload failed: HTTP {resp.status_code} - {msg}")
                raise HTTPException(status_code=resp.status_code, detail=f"Storage upload failed (HTTP {resp.status_code}): {msg}")
            logger.info("REST fallback upload succeeded.")
        except HTTPException:
            raise
        except Exception as rest_e:
            logger.error(f"REST fallback also failed: {str(rest_e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Both SDK and REST upload failed. Check server logs.")

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
    if not filename.startswith(f"req_{request_id}_"):
        raise HTTPException(status_code=403, detail="Unauthorized access to this file")

    supabase = get_supabase()
    try:
        res = supabase.storage.from_(bucket).create_signed_url(filename, 3600)
        signed_url = res if isinstance(res, str) else res.get("signedURL") or res.get("signedUrl")
        if not signed_url:
            raise Exception("No signed URL returned")
        return RedirectResponse(url=signed_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not generate download link")



def _authorize(db: Session, request_id: int, user_id: int) -> models.ConnectionRequest:
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    if not req or user_id not in (req.from_user_id, req.to_user_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    if req.status != "accepted":
        raise HTTPException(status_code=403, detail="Request has not been accepted yet")
    return req


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


async def _broadcast_message_update(request_id: int, msg: models.Message) -> None:
    """Broadcast a message_update event to all participants in a conversation."""
    try:
        await chat_manager.broadcast(request_id, {
            "type": "message_update",
            "message": _serialize_message(msg),
        })
    except Exception:
        pass  # Never let a failed broadcast crash the REST response


from sqlalchemy import or_, desc, func

@router.get("/inbox", response_model=List[schemas.InboxConversationOut])
def get_inbox(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch requests where user is either from or to
    reqs = db.query(models.ConnectionRequest).filter(
        or_(
            models.ConnectionRequest.from_user_id == current_user.id,
            models.ConnectionRequest.to_user_id == current_user.id
        ),
        models.ConnectionRequest.status == 'accepted'
    ).all()

    if not reqs:
        return []

    req_ids = [r.id for r in reqs]
    other_user_ids = {r.to_user_id if r.from_user_id == current_user.id else r.from_user_id for r in reqs}
    skill_ids = {r.skill_id for r in reqs}

    users_map = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(other_user_ids)).all()}
    skills_map = {s.id: s for s in db.query(models.Skill).filter(models.Skill.id.in_(skill_ids)).all()}
    sessions_map = {s.request_id: s for s in db.query(models.Session).filter(models.Session.request_id.in_(req_ids)).all()}

    # Hidden messages subquery
    hidden_subq = db.query(models.MessageUserState.message_id).filter(
        models.MessageUserState.user_id == current_user.id
    ).subquery()

    # Unread counts map
    unread_counts = db.query(
        models.Message.request_id, func.count(models.Message.id)
    ).filter(
        models.Message.request_id.in_(req_ids),
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False,
        ~models.Message.id.in_(hidden_subq)
    ).group_by(models.Message.request_id).all()
    unread_map = {row[0]: row[1] for row in unread_counts}

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
    latest_msg_map = {m.request_id: m for m in latest_msgs}

    inbox = []
    for req in reqs:
        other_user_id = req.to_user_id if req.from_user_id == current_user.id else req.from_user_id
        other_user = users_map.get(other_user_id)
        skill = skills_map.get(req.skill_id)

        latest_msg = latest_msg_map.get(req.id)
        unread_count = unread_map.get(req.id, 0)
        session = sessions_map.get(req.id)

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
            scheduled_end=session.scheduled_end if session else None
        ))

    # Sort by latest message time descending
    inbox.sort(key=lambda x: x.latest_message_time.timestamp() if x.latest_message_time else 0, reverse=True)
    return inbox

@router.post("/{request_id}/read")
async def mark_conversation_read(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    req = _authorize(db, request_id, current_user.id)
    # Mark messages from the OTHER user as read
    other_user_id = req.to_user_id if req.from_user_id == current_user.id else req.from_user_id

    unread_messages = db.query(models.Message).filter(
        models.Message.request_id == request_id,
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

    try:
        await chat_manager.broadcast(request_id, {
            "type": "messages_read",
            "request_id": request_id,
            "reader_id": current_user.id,
            "message_ids": msg_ids
        })
    except Exception:
        pass

    return {"detail": "Messages marked as read", "message_ids": msg_ids}

@router.get("/{request_id}/messages", response_model=List[schemas.MessageOut])
def list_messages(
    request_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _authorize(db, request_id, current_user.id)
    hidden_subq = db.query(models.MessageUserState.message_id).filter(
        models.MessageUserState.user_id == current_user.id
    ).subquery()
    rows = db.query(models.Message).filter(
        models.Message.request_id == request_id,
        ~models.Message.id.in_(hidden_subq)
    ).order_by(models.Message.created_at).all()
    return rows


@router.post("/{request_id}/messages", response_model=schemas.MessageOut)
def send_message(
    request_id: int,
    payload: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    _authorize(db, request_id, current_user.id)
    msg = models.Message(request_id=request_id, sender_id=current_user.id, content=payload.content, message_metadata=payload.metadata)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    req = db.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
    other_user_id = req.to_user_id if req.from_user_id == current_user.id else req.from_user_id
    create_notification(db, other_user_id, "message", "New Message", f"{current_user.name} sent you a message", request_id, "chat")
    return msg


def _authenticate_ws(token: str, db: Session) -> Optional[models.User]:
    """Same JWT the REST API uses, just decoded manually — browsers can't set
    Authorization headers on a native WebSocket handshake, so the token is
    passed as a query param instead: /chat/ws/{request_id}?token=..."""
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.query(models.User).filter(models.User.id == int(user_id)).first()


def _ws_auth_and_authz(token: str, request_id: int):
    db = SessionLocal()
    try:
        user = _authenticate_ws(token, db)
        if not user:
            return None, 4401, None
        try:
            req = _authorize(db, request_id, user.id)
            other_user_id = req.to_user_id if req.from_user_id == user.id else req.from_user_id
            return user, None, other_user_id
        except HTTPException:
            return None, 4403, None
    finally:
        db.close()

def _fetch_history(request_id: int, user_id: int):
    db_hist = SessionLocal()
    try:
        hidden_subq = db_hist.query(models.MessageUserState.message_id).filter(
            models.MessageUserState.user_id == user_id
        ).subquery()
        
        messages = db_hist.query(models.Message).filter(
            models.Message.request_id == request_id,
            ~models.Message.id.in_(hidden_subq)
        ).order_by(models.Message.created_at).all()
        return [_serialize_message(m) for m in messages]
    finally:
        db_hist.close()

def _save_message_and_notify(request_id: int, user_id: int, user_name: str, content: str, metadata: dict = None):
    db_msg = SessionLocal()
    try:
        msg = models.Message(request_id=request_id, sender_id=user_id, content=content, message_metadata=metadata or {})
        db_msg.add(msg)
        db_msg.commit()
        db_msg.refresh(msg)
        req = db_msg.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
        if req:
            other_user_id = req.to_user_id if req.from_user_id == user_id else req.from_user_id
            create_notification(db_msg, other_user_id, "message", "New Message", f"{user_name} sent you a message", request_id, "chat")

        return _serialize_message(msg)
    finally:
        db_msg.close()

@router.websocket("/ws/{request_id}")
async def chat_websocket(websocket: WebSocket, request_id: int, token: str = Query(...)):
    user, error_code, other_user_id = await run_in_threadpool(_ws_auth_and_authz, token, request_id)
    if error_code:
        await websocket.close(code=error_code)
        return

    await chat_manager.connect(request_id, websocket)

    # Broadcast presence online
    await chat_manager.broadcast(request_id, {
        "type": "presence_update",
        "user_id": user.id,
        "status": "online"
    })

    # Tell me if the other user is already online
    if chat_manager.room_size(request_id) > 1:
        await websocket.send_json({
            "type": "presence_update",
            "user_id": other_user_id,
            "status": "online"
        })

    # Send history immediately upon connection
    hist_messages = await run_in_threadpool(_fetch_history, request_id, user.id)
    await websocket.send_json({"type": "history", "messages": hist_messages})

    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            metadata = data.get("metadata", {})
            if not content and not metadata:
                continue

            msg_payload = await run_in_threadpool(_save_message_and_notify, request_id, user.id, user.name, content, metadata)
            msg_payload["type"] = "message"
            await chat_manager.broadcast(request_id, msg_payload)
    except WebSocketDisconnect:
        chat_manager.disconnect(request_id, websocket)
        last_active_iso = await run_in_threadpool(_update_last_active, user.id)
        await chat_manager.broadcast(request_id, {
            "type": "presence_update",
            "user_id": user.id,
            "status": "offline",
            "last_active": last_active_iso
        })

def _update_last_active(user_id: int) -> str:
    db = SessionLocal()
    try:
        from ..utils.timezone import utc_now
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
async def edit_message(
    message_id: int,
    payload: schemas.MessageEdit,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    msg = _get_message_authorized(db, message_id, current_user.id)
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can edit this message")
    if (msg.message_metadata or {}).get("deleted_for_everyone"):
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    from ..utils.timezone import utc_now
    new_meta = dict(msg.message_metadata or {})
    new_meta["edited_at"] = utc_now().isoformat()
    msg.content = payload.content
    msg.message_metadata = new_meta
    db.commit()
    db.refresh(msg)

    # Broadcast real-time update to both participants
    await _broadcast_message_update(msg.request_id, msg)
    return msg


@router.delete("/messages/{message_id}")
async def delete_message_for_everyone(
    message_id: int,
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
    await _broadcast_message_update(request_id, msg)
    return {"detail": "Message deleted", "id": message_id, "request_id": request_id}


@router.post("/messages/{message_id}/hide")
def delete_message_for_me(
    message_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    msg = _get_message_authorized(db, message_id, current_user.id)
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
async def toggle_reaction(
    message_id: int,
    payload: schemas.ReactionUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    msg = _get_message_authorized(db, message_id, current_user.id)
    new_meta = dict(msg.message_metadata or {})
    reactions = dict(new_meta.get("reactions", {}))

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
    await _broadcast_message_update(msg.request_id, msg)
    return {
        "id": msg.id,
        "request_id": msg.request_id,
        "metadata": msg.message_metadata,
    }

