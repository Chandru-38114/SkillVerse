from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db, SessionLocal
from ..ws_manager import chat_manager

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


@router.websocket("/ws/{request_id}")
async def chat_websocket(websocket: WebSocket, request_id: int, token: str = Query(...)):
    # Each connection gets its own DB session since this runs outside the
    # normal Depends(get_db) request lifecycle.
    db = SessionLocal()
    try:
        user = _authenticate_ws(token, db)
        if not user:
            await websocket.close(code=4401)  # custom code: unauthenticated
            return
        try:
            _authorize(db, request_id, user.id)
        except HTTPException:
            await websocket.close(code=4403)  # custom code: forbidden
            return

        await chat_manager.connect(request_id, websocket)
        try:
            while True:
                data = await websocket.receive_json()
                content = (data.get("content") or "").strip()
                if not content:
                    continue

                msg = models.Message(request_id=request_id, sender_id=user.id, content=content)
                db.add(msg)
                db.commit()
                db.refresh(msg)

                await chat_manager.broadcast(request_id, {
                    "type": "message",
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat(),
                })
        except WebSocketDisconnect:
            chat_manager.disconnect(request_id, websocket)
    finally:
        db.close()