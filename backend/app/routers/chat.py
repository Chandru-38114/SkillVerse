from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from starlette.concurrency import run_in_threadpool
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from ..notification_service import create_notification

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from ..ws_manager import chat_manager

router = APIRouter(prefix="/chat", tags=["chat"])


import uuid
import mimetypes
from fastapi import UploadFile, File
from fastapi.responses import RedirectResponse
from ..supabase_client import get_supabase

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
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    filename = f"chat_{request_id}_{uuid.uuid4().hex}_{file.filename}"
    supabase = get_supabase()

    try:
        supabase.storage.from_("materials").upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": ALLOWED_EXTENSIONS[ext]}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

    # We return a standard markdown string that the frontend can insert into the chat
    url = f"/api/chat/{request_id}/attachment/{filename}"

    if ext in ["png", "jpg", "jpeg"]:
        md = f"![{file.filename}]({url})"
    else:
        md = f"[{file.filename}]({url})"

    return {"markdown": md, "url": url, "filename": file.filename}


@router.get("/{request_id}/attachment/{filename}")
def download_attachment(
    request_id: int,
    filename: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)

    supabase = get_supabase()
    try:
        res = supabase.storage.from_("materials").create_signed_url(filename, 3600)
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

    # Unread counts map
    unread_counts = db.query(
        models.Message.request_id, func.count(models.Message.id)
    ).filter(
        models.Message.request_id.in_(req_ids),
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False
    ).group_by(models.Message.request_id).all()
    unread_map = {row[0]: row[1] for row in unread_counts}

    # Latest messages map
    subq = db.query(
        models.Message.request_id,
        func.max(models.Message.created_at).label('max_dt')
    ).filter(models.Message.request_id.in_(req_ids)).group_by(models.Message.request_id).subquery()

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
def mark_conversation_read(
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

    for msg in unread_messages:
        msg.is_read = True

    db.commit()
    return {"detail": "Messages marked as read"}

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
            return None, 4401
        try:
            _authorize(db, request_id, user.id)
            return user, None
        except HTTPException:
            return None, 4403
    finally:
        db.close()

def _fetch_history(request_id: int):
    db_hist = SessionLocal()
    try:
        messages = db_hist.query(models.Message).filter(models.Message.request_id == request_id).order_by(models.Message.created_at).all()
        return [{
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.content,
            "created_at": enforce_utc_iso(m.created_at)
        } for m in messages]
    finally:
        db_hist.close()

def _save_message_and_notify(request_id: int, user_id: int, user_name: str, content: str):
    db_msg = SessionLocal()
    try:
        msg = models.Message(request_id=request_id, sender_id=user_id, content=content)
        db_msg.add(msg)
        db_msg.commit()
        db_msg.refresh(msg)
        req = db_msg.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
        if req:
            other_user_id = req.to_user_id if req.from_user_id == user_id else req.from_user_id
            create_notification(db_msg, other_user_id, "message", "New Message", f"{user_name} sent you a message", request_id, "chat")

        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "created_at": enforce_utc_iso(msg.created_at)
        }
    finally:
        db_msg.close()

@router.websocket("/ws/{request_id}")
async def chat_websocket(websocket: WebSocket, request_id: int, token: str = Query(...)):
    user, error_code = await run_in_threadpool(_ws_auth_and_authz, token, request_id)
    if error_code:
        await websocket.close(code=error_code)
        return

    await chat_manager.connect(request_id, websocket)

    # Send history immediately upon connection
    hist_messages = await run_in_threadpool(_fetch_history, request_id)
    await websocket.send_json({"type": "history", "messages": hist_messages})

    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue

            msg_payload = await run_in_threadpool(_save_message_and_notify, request_id, user.id, user.name, content)
            msg_payload["type"] = "message"
            await chat_manager.broadcast(request_id, msg_payload)
    except WebSocketDisconnect:
        chat_manager.disconnect(request_id, websocket)
