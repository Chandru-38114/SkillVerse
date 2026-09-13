from typing import Optional
import os
import sys
import tempfile
import subprocess
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/compiler", tags=["compiler"])

class RunRequest(BaseModel):
    code: str = Field(..., max_length=10000)

class RunResponse(BaseModel):
    output: str
    error: Optional[str] = None

@router.post("/{session_id}/run", response_model=RunResponse)
def run_code(
    session_id: int,
    payload: RunRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Authorize: user must be participant of this session
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized to access this session's compiler")

    # 2. Write code to a secure temporary file
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as temp_file:
            temp_file.write(payload.code)
            temp_path = temp_file.name
        
        # 3. Execute subprocess with a strict timeout (3 seconds) using the sandbox
        # We pass the sandbox script and the temporary file path as arguments.
        sandbox_script = os.path.join(os.path.dirname(__file__), '..', 'sandbox.py')
        
        # In a real production deployment on Linux, we might prefix with `sudo -u nobody` 
        # or use `docker run`, but here the sandbox.py handles dropping privileges/env/builtins.
        result = subprocess.run(
            [sys.executable, sandbox_script, temp_path],
            capture_output=True,
            text=True,
            timeout=3.0
        )
        
        output = result.stdout
        error = result.stderr if result.returncode != 0 else None
        
        return RunResponse(output=output, error=error)
        
    except subprocess.TimeoutExpired:
        return RunResponse(output="", error="Execution Error: Code exceeded the 3-second timeout limit.")
    except Exception as e:
        return RunResponse(output="", error=f"System Error: Could not execute code. {str(e)}")
    finally:
        # Clean up the temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

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

@router.websocket("/{session_id}/ws")
async def compiler_websocket(websocket: WebSocket, session_id: int, token: str, db: Session = Depends(get_db)):
    # Authenticate token
    user_id = auth.get_user_id_from_token_sync(token)
    print(f"WS auth: token={token[:10]} user_id={user_id}")
    if not user_id:
        await websocket.close(code=1008)
        return

    # Verify session
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if session_db:
        print(f"WS session {session_id}: tutor={session_db.tutor_id} learner={session_db.learner_id}")
    else:
        print(f"WS session {session_id} not found")
        
    if not session_db or user_id not in [session_db.tutor_id, session_db.learner_id]:
        await websocket.close(code=1008)
        return

    await compiler_manager.connect(websocket, session_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "update_code":
                    new_code = msg.get("code")
                    comp = db.query(models.CompilerState).filter_by(session_id=session_id).first()
                    if not comp:
                        comp = models.CompilerState(session_id=session_id, code=new_code, version=1)
                        db.add(comp)
                    else:
                        comp.code = new_code
                        comp.version += 1
                    db.commit()
                    db.refresh(comp)
                    
                    # Broadcast the event with version
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "update_code",
                        "code": comp.code,
                        "version": comp.version
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
