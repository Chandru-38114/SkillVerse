from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .. import models, auth
from ..database import get_db, SessionLocal
from ..services.code_runner import run_python

router = APIRouter(prefix="/compiler", tags=["compiler"])

class RunRequest(BaseModel):
    code: str = Field(..., max_length=10000)

class RunResponse(BaseModel):
    output: str
    error: Optional[str] = None


def execute_python(code: str) -> "RunResponse":
    """Run untrusted Python in the sandbox with an empty environment and hard limits.
    The child never sees DATABASE_URL, GEMINI_API_KEY or any other server secret."""
    result = run_python(code)
    return RunResponse(output=result["output"], error=result["error"])


# Declared BEFORE "/{session_id}/run" so "arena" is not parsed as a session id.
@router.post("/arena/run", response_model=RunResponse)
def run_arena_code(
    payload: RunRequest,
    current_user: models.User = Depends(auth.get_current_user),
):
    """Code runner for the Skill Arena: any signed-in user, no learning session needed."""
    return execute_python(payload.code)


@router.post("/{session_id}/run", response_model=RunResponse)
def run_code(
    session_id: int,
    payload: RunRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # Authorize: user must be participant of this session
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized to access this session's compiler")
    return execute_python(payload.code)

class CompilerSaveRequest(BaseModel):
    code: str

class CompilerResponse(BaseModel):
    code: str
    version: int

# In-memory connection manager for Compiler WebSockets
class CompilerConnectionManager:
    def __init__(self):
        # session_id -> { user_id -> websocket }
        self.active_connections: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: int, user_id: int):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        self.active_connections[session_id][user_id] = websocket

    def disconnect(self, session_id: int, user_id: int):
        if session_id in self.active_connections:
            if user_id in self.active_connections[session_id]:
                del self.active_connections[session_id][user_id]
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: int, sender_id: int, message: str):
        if session_id in self.active_connections:
            for user_id, connection in self.active_connections[session_id].items():
                if user_id != sender_id:
                    await connection.send_text(message)

compiler_manager = CompilerConnectionManager()

@router.get("/{session_id}/state", response_model=CompilerResponse)
def get_compiler_state(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    comp = db.query(models.CompilerState).filter_by(session_id=session_id).first()
    if not comp:
        return {"code": 'print("Hello, SkillVerse!")', "version": 0}
    return {"code": comp.code, "version": comp.version}

@router.put("/{session_id}/state")
def save_compiler_state(
    session_id: int,
    payload: CompilerSaveRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    comp = db.query(models.CompilerState).filter_by(session_id=session_id).first()
    if not comp:
        comp = models.CompilerState(session_id=session_id, code=payload.code, version=1)
        db.add(comp)
    else:
        comp.code = payload.code
        comp.version += 1
    db.commit()
    db.refresh(comp)
    return {"status": "saved", "version": comp.version}

from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio
from starlette.concurrency import run_in_threadpool

compiler_save_tasks = {}

def _sync_save_compiler(session_id: int, new_code: str):
    db_loop = SessionLocal()
    try:
        comp = db_loop.query(models.CompilerState).filter_by(session_id=session_id).first()
        if not comp:
            comp = models.CompilerState(session_id=session_id, code=new_code, version=1)
            db_loop.add(comp)
        else:
            comp.code = new_code
            comp.version += 1
        db_loop.commit()
    finally:
        db_loop.close()

async def debounced_save_compiler(session_id: int, new_code: str):
    try:
        await asyncio.sleep(2.0)
        await run_in_threadpool(_sync_save_compiler, session_id, new_code)
    except asyncio.CancelledError:
        pass
    finally:
        if session_id in compiler_save_tasks:
            # We don't want to delete a task if a new one replaced us, so this is risky.
            # Usually it's fine to just let the dict be overwritten.
            pass


@router.websocket("/{session_id}/ws")
async def compiler_websocket(websocket: WebSocket, session_id: int, token: str):
    # Short-lived DB session for initial validation
    db = SessionLocal()
    try:
        user_id = auth.get_user_id_from_token_sync(token)
        if not user_id:
            await websocket.close(code=1008)
            return
            
        session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not session_db or user_id not in [session_db.tutor_id, session_db.learner_id]:
            await websocket.close(code=1008)
            return
    finally:
        db.close()

    await compiler_manager.connect(websocket, session_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "update_code":
                    new_code = msg.get("code")
                    
                    if session_id in compiler_save_tasks:
                        compiler_save_tasks[session_id].cancel()
                        
                    compiler_save_tasks[session_id] = asyncio.create_task(
                        debounced_save_compiler(session_id, new_code)
                    )
                    
                    # Broadcast immediately with a timestamp version
                    import time
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "update_code",
                        "code": new_code,
                        "version": int(time.time() * 1000)
                    }))
                elif msg.get("type") == "execution_result":
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "execution_result",
                        "output": msg.get("output", ""),
                        "error": msg.get("error", ""),
                        "user_name": msg.get("user_name", ""),
                        "timestamp": msg.get("timestamp")
                    }))
            except Exception as e:
                pass
    except WebSocketDisconnect:
        compiler_manager.disconnect(session_id, user_id)
