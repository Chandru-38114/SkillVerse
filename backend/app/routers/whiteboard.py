from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json

from .. import models, auth
from ..database import get_db, SessionLocal

router = APIRouter(prefix="/sessions", tags=["whiteboard"])

# A board is a JSON list of shapes; 2 MB is far more than a real lesson needs
# and stops one request from filling the database.
MAX_STATE_CHARS = 2_000_000


class WhiteboardSaveRequest(BaseModel):
    state: str = Field(..., max_length=MAX_STATE_CHARS)

class WhiteboardResponse(BaseModel):
    state: str

# In-memory connection manager for Whiteboard WebSockets
class ConnectionManager:
    def __init__(self):
        # session_id -> { user_id -> websocket }
        self.active_connections: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: int, user_id: int, accept: bool = True):
        if accept:
            await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        # Allow max 2 connections? The logic ensures only tutor/learner can connect.
        self.active_connections[session_id][user_id] = websocket

    def disconnect(self, session_id: int, user_id: int):
        if session_id in self.active_connections:
            if user_id in self.active_connections[session_id]:
                del self.active_connections[session_id][user_id]
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: int, sender_id: int, message: str):
        if session_id in self.active_connections:
            for user_id, connection in list(self.active_connections[session_id].items()):
                if user_id != sender_id:
                    try:
                        await connection.send_text(message)
                    except Exception:
                        self.disconnect(session_id, user_id)

manager = ConnectionManager()

@router.get("/{session_id}/whiteboard", response_model=WhiteboardResponse)
def get_whiteboard(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    wb = db.query(models.WhiteboardState).filter_by(session_id=session_id).first()
    if not wb:
        return {"state": "[]"}
    return {"state": wb.state}

@router.put("/{session_id}/whiteboard")
def save_whiteboard(
    session_id: int,
    payload: WhiteboardSaveRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    wb = db.query(models.WhiteboardState).filter_by(session_id=session_id).first()
    if not wb:
        wb = models.WhiteboardState(session_id=session_id, state=payload.state)
        db.add(wb)
    else:
        wb.state = payload.state
    db.commit()
    return {"status": "saved"}

@router.websocket("/{session_id}/whiteboard/ws")
async def whiteboard_websocket(websocket: WebSocket, session_id: int, token: str):
    db = SessionLocal()
    try:
        # Accept FIRST, then close with a specific code (CLAUDE.md rule).
        await websocket.accept()
        user_id = auth.get_user_id_from_token_sync(token)
        if not user_id:
            await websocket.close(code=4401)
            return

        session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not session_db or user_id not in [session_db.tutor_id, session_db.learner_id]:
            await websocket.close(code=4403)
            return
        if session_db.status != "scheduled":
            await websocket.close(code=4410)
            return
    finally:
        db.close()

    await manager.connect(websocket, session_id, user_id, accept=False)
    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > MAX_STATE_CHARS:
                continue
            await manager.broadcast(session_id, user_id, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(session_id, user_id)
