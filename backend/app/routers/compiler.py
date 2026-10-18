"""
Code compiler.

- POST /compiler/arena/run          run code in the Skill Arena (any signed-in user)
- POST /compiler/{session_id}/run   run code in a Learning Arena session
- GET/PUT /compiler/{session_id}/state   load / save the shared editor
- WS  /compiler/{session_id}/ws     live code sync between tutor and learner

Only Python runs, in the sandbox (services/code_runner.py + sandbox.py).
"""
import asyncio
import json
import time
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from .. import models, auth
from ..database import get_db, SessionLocal
from ..services.code_runner import run_python
from ..services.session_access import get_session_for_participant, is_participant
from ..ws_manager import SessionRoomManager

router = APIRouter(prefix="/compiler", tags=["compiler"])

MAX_RELAYED_OUTPUT_CHARS = 20_000
MAX_SHARED_CODE_CHARS = 50_000
DEFAULT_CODE = 'print("Hello, SkillVerse!")'
SAVE_DELAY_SECONDS = 2.0  # live edits are saved 2 s after the last keystroke


class RunRequest(BaseModel):
    code: str = Field(..., max_length=10000)


class RunResponse(BaseModel):
    output: str
    error: Optional[str] = None


class CompilerSaveRequest(BaseModel):
    code: str = Field(..., max_length=MAX_SHARED_CODE_CHARS)


class CompilerResponse(BaseModel):
    code: str
    version: int


# ---------------------------------------------------------------------------
# Running code
# ---------------------------------------------------------------------------
def execute_python(code: str) -> RunResponse:
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
    get_session_for_participant(
        db, session_id, current_user.id, "Not authorized to access this session's compiler"
    )
    return execute_python(payload.code)


# ---------------------------------------------------------------------------
# Saved editor state
# ---------------------------------------------------------------------------
def _store_code(db: Session, session_id: int, code: str) -> models.CompilerState:
    """Create or update the saved code for a session and bump its version."""
    comp = db.query(models.CompilerState).filter_by(session_id=session_id).first()
    if not comp:
        comp = models.CompilerState(session_id=session_id, code=code, version=1)
        db.add(comp)
    else:
        comp.code = code
        comp.version += 1
    db.commit()
    return comp


@router.get("/{session_id}/state", response_model=CompilerResponse)
def get_compiler_state(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    get_session_for_participant(db, session_id, current_user.id)
    comp = db.query(models.CompilerState).filter_by(session_id=session_id).first()
    if not comp:
        return {"code": DEFAULT_CODE, "version": 0}
    return {"code": comp.code, "version": comp.version}


@router.put("/{session_id}/state")
def save_compiler_state(
    session_id: int,
    payload: CompilerSaveRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    get_session_for_participant(db, session_id, current_user.id)
    comp = _store_code(db, session_id, payload.code)
    db.refresh(comp)
    return {"status": "saved", "version": comp.version}


# ---------------------------------------------------------------------------
# Live sync (WebSocket)
# ---------------------------------------------------------------------------
compiler_manager = SessionRoomManager()
compiler_save_tasks = {}  # session_id -> the pending delayed save


def _save_code_now(session_id: int, new_code: str) -> None:
    db = SessionLocal()
    try:
        _store_code(db, session_id, new_code)
    finally:
        db.close()


async def debounced_save_compiler(session_id: int, new_code: str):
    """Save after SAVE_DELAY_SECONDS; a newer edit cancels this one first."""
    try:
        await asyncio.sleep(SAVE_DELAY_SECONDS)
        await run_in_threadpool(_save_code_now, session_id, new_code)
    except asyncio.CancelledError:
        pass


@router.websocket("/{session_id}/ws")
async def compiler_websocket(websocket: WebSocket, session_id: int, token: str):
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

    await compiler_manager.connect(session_id, user_id, websocket, accept=False)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "update_code":
                    new_code = msg.get("code")
                    if not isinstance(new_code, str) or len(new_code) > MAX_SHARED_CODE_CHARS:
                        continue
                    # Restart the delayed save with the newest code.
                    if session_id in compiler_save_tasks:
                        compiler_save_tasks[session_id].cancel()
                    compiler_save_tasks[session_id] = asyncio.create_task(
                        debounced_save_compiler(session_id, new_code)
                    )
                    # Send the edit to the partner immediately.
                    await compiler_manager.broadcast_text(session_id, user_id, json.dumps({
                        "type": "update_code",
                        "code": new_code,
                        "version": int(time.time() * 1000),
                    }))
                elif msg.get("type") == "execution_result":
                    # Relayed to the partner as plain text, capped like real run output.
                    await compiler_manager.broadcast_text(session_id, user_id, json.dumps({
                        "type": "execution_result",
                        "output": str(msg.get("output", ""))[:MAX_RELAYED_OUTPUT_CHARS],
                        "error": str(msg.get("error", ""))[:MAX_RELAYED_OUTPUT_CHARS],
                        "user_name": str(msg.get("user_name", ""))[:80],
                        "timestamp": msg.get("timestamp") if isinstance(msg.get("timestamp"), (int, float, str)) else None,
                    }))
            except Exception:
                pass  # ignore a bad message, keep the connection
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Pass the socket: if this user already reconnected, keep the new one.
        compiler_manager.disconnect(session_id, user_id, websocket)
