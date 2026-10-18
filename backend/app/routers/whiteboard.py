"""
Shared whiteboard for a Learning Arena session.

- GET/PUT /sessions/{session_id}/whiteboard     load / save the board
- WS      /sessions/{session_id}/whiteboard/ws  live drawing between the two people
"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models, auth
from ..database import get_db, SessionLocal
from ..services.session_access import get_session_for_participant, is_participant
from ..ws_manager import SessionRoomManager

router = APIRouter(prefix="/sessions", tags=["whiteboard"])

# A board is a JSON list of shapes; 2 MB is far more than a real lesson needs
# and stops one request from filling the database.
MAX_STATE_CHARS = 2_000_000


class WhiteboardSaveRequest(BaseModel):
    state: str = Field(..., max_length=MAX_STATE_CHARS)


class WhiteboardResponse(BaseModel):
    state: str


manager = SessionRoomManager()


@router.get("/{session_id}/whiteboard", response_model=WhiteboardResponse)
def get_whiteboard(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    get_session_for_participant(db, session_id, current_user.id)
    wb = db.query(models.WhiteboardState).filter_by(session_id=session_id).first()
    return {"state": wb.state if wb else "[]"}


@router.put("/{session_id}/whiteboard")
def save_whiteboard(
    session_id: int,
    payload: WhiteboardSaveRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    get_session_for_participant(db, session_id, current_user.id)
    wb = db.query(models.WhiteboardState).filter_by(session_id=session_id).first()
    if not wb:
        db.add(models.WhiteboardState(session_id=session_id, state=payload.state))
    else:
        wb.state = payload.state
    db.commit()
    return {"status": "saved"}


@router.websocket("/{session_id}/whiteboard/ws")
async def whiteboard_websocket(websocket: WebSocket, session_id: int, token: str):
    # Accept FIRST, then close with a specific code (CLAUDE.md rule).
    db = SessionLocal()
    try:
        await websocket.accept()
        user_id = auth.get_user_id_from_token_sync(token)
        if not user_id:
            await websocket.close(code=4401)
            return
        session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not session_db or not is_participant(session_db, user_id):
            await websocket.close(code=4403)
            return
        if session_db.status != "scheduled":
            await websocket.close(code=4410)
            return
    finally:
        db.close()

    await manager.connect(session_id, user_id, websocket, accept=False)
    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > MAX_STATE_CHARS:
                continue
            await manager.broadcast_text(session_id, user_id, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(session_id, user_id)
