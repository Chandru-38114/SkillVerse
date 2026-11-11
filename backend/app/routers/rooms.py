"""
Learning Rooms — group rooms with chat, a video/audio call, a shared code editor
+ compiler and a shared whiteboard.

A room is reached by its unguessable `code` (the share link is /rooms/<code>).
- public  rooms are listed for everyone and anyone signed in can join;
- private rooms are not listed: only people with the link (or already members) can join.
The host manages the room: edit, lock (no new joins), remove people, close.

REST  (prefix /rooms)
  POST   /rooms                         create
  GET    /rooms                         public open rooms + rooms I'm in
  GET    /rooms/{code}                  details + members (anyone with the link who isn't removed)
  POST   /rooms/{code}/join | /leave
  PATCH  /rooms/{code}                  host: title, description, visibility, status, max
  POST   /rooms/{code}/remove/{user_id} host: remove someone (they can't rejoin)
  DELETE /rooms/{code}                  host: close the room
  GET    /rooms/{code}/messages         last 100 chat messages (members)
  GET/PUT /rooms/{code}/whiteboard      shared board
  GET/PUT /rooms/{code}/code            shared editor
  POST   /rooms/{code}/run              run code (same sandboxes as the Learning Arena)
WS    /rooms/ws/{code}?token=           one socket per member: chat, call signalling,
                                        live code and board updates
"""
import asyncio
import json
import logging
import secrets
import time
from collections import defaultdict, deque
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from .. import auth, models
from ..database import SessionLocal, get_db
from ..services.code_exec import run_program
from ..utils.timezone import utc_now
from .compiler import RunRequest, RunResponse, CompilerSaveRequest, CompilerResponse, DEFAULT_CODE, MAX_SHARED_CODE_CHARS
from .whiteboard import WhiteboardSaveRequest, WhiteboardResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])
logger = logging.getLogger(__name__)

MAX_ROOM_SIZE = 8            # a mesh video call stays smooth up to about 8 people
MAX_CHAT_CHARS = 1000
RUNS_PER_MINUTE = 20
_recent_runs: Dict[int, deque] = defaultdict(deque)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class RoomCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field("", max_length=1000)
    skill: str = Field("", max_length=60)
    visibility: str = Field("public", pattern="^(public|private)$")
    max_participants: int = Field(8, ge=2, le=MAX_ROOM_SIZE)


class RoomUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[str] = Field(None, pattern="^(public|private)$")
    status: Optional[str] = Field(None, pattern="^(open|locked)$")
    max_participants: Optional[int] = Field(None, ge=2, le=MAX_ROOM_SIZE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _room(db: Session, code: str) -> models.LearningRoom:
    room = db.query(models.LearningRoom).filter(models.LearningRoom.code == code).first()
    if not room or room.status == "closed":
        raise HTTPException(status_code=404, detail="Room not found or closed")
    return room


def _member(db: Session, room: models.LearningRoom, user_id: int) -> Optional[models.RoomMember]:
    return db.query(models.RoomMember).filter_by(room_id=room.id, user_id=user_id).first()


def _require_member(db: Session, room: models.LearningRoom, user_id: int) -> models.RoomMember:
    m = _member(db, room, user_id)
    if not m or m.status != "active":
        raise HTTPException(status_code=403, detail="Join the room first")
    return m


def _require_host(room: models.LearningRoom, user_id: int) -> None:
    if room.host_id != user_id:
        raise HTTPException(status_code=403, detail="Only the host can do that")


def _active_members(db: Session, room: models.LearningRoom) -> List[models.RoomMember]:
    return (db.query(models.RoomMember)
            .filter_by(room_id=room.id, status="active")
            .order_by(models.RoomMember.joined_at.asc()).all())


def _person(u: models.User) -> dict:
    return {"id": u.id, "name": u.name, "avatar_url": u.profile_picture_url}


def _out(db: Session, room: models.LearningRoom, me_id: int, with_members: bool = True) -> dict:
    members = _active_members(db, room)
    mine = _member(db, room, me_id)
    data = {
        "code": room.code,
        "title": room.title,
        "description": room.description or "",
        "skill": room.skill or "",
        "visibility": room.visibility,
        "status": room.status,
        "max_participants": room.max_participants,
        "host": _person(room.host) if room.host else None,
        "is_host": room.host_id == me_id,
        "my_status": mine.status if mine else None,
        "member_count": len(members),
        "online_count": len(hub.rooms.get(room.id, {})),
        "call_active": room.id in hub.calls,
        "created_at": room.created_at,
    }
    if with_members:
        online = hub.rooms.get(room.id, {})
        data["members"] = [{**_person(m.user), "role": m.role, "online": m.user_id in online,
                            "in_call": m.user_id in hub.calls.get(room.id, {}).get("members", set())}
                           for m in members if m.user]
    return data


# ---------------------------------------------------------------------------
# Live hub: room_id -> {user_id: websocket}
# ---------------------------------------------------------------------------
class RoomHub:
    def __init__(self):
        self.rooms: Dict[int, Dict[int, WebSocket]] = {}
        self.calls: Dict[int, dict] = {}      # room_id -> {"mode": "video"|"audio", "members": set(user ids)}

    def add(self, room_id: int, user_id: int, ws: WebSocket) -> Optional[WebSocket]:
        room = self.rooms.setdefault(room_id, {})
        old = room.get(user_id)
        room[user_id] = ws
        return old

    def remove(self, room_id: int, user_id: int, ws: Optional[WebSocket] = None) -> bool:
        room = self.rooms.get(room_id)
        if not room or user_id not in room or (ws is not None and room[user_id] is not ws):
            return False
        del room[user_id]
        if not room:
            self.rooms.pop(room_id, None)
            self.calls.pop(room_id, None)
        return True

    async def send(self, room_id: int, user_id: int, msg: dict) -> None:
        ws = self.rooms.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(msg)
            except Exception:
                self.remove(room_id, user_id, ws)

    async def broadcast(self, room_id: int, msg: dict, exclude: Optional[int] = None) -> None:
        for uid in list(self.rooms.get(room_id, {})):
            if uid != exclude:
                await self.send(room_id, uid, msg)

    async def kick(self, room_id: int, user_id: int, reason: str) -> None:
        ws = self.rooms.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json({"type": "removed", "reason": reason})
                await ws.close(code=4403, reason=reason)
            except Exception:
                pass
            self.remove(room_id, user_id, ws)
        await self.leave_call(room_id, user_id)

    async def leave_call(self, room_id: int, user_id: int) -> None:
        call = self.calls.get(room_id)
        if call and user_id in call["members"]:
            call["members"].discard(user_id)
            await self.broadcast(room_id, {"type": "call_left", "user_id": user_id})


hub = RoomHub()


# ---------------------------------------------------------------------------
# REST
# ---------------------------------------------------------------------------
@router.post("")
def create_room(payload: RoomCreate, current_user: models.User = Depends(auth.get_current_user),
                db: Session = Depends(get_db)):
    room = models.LearningRoom(
        code=secrets.token_urlsafe(9), title=payload.title.strip(), description=payload.description.strip(),
        skill=payload.skill.strip(), host_id=current_user.id, visibility=payload.visibility,
        max_participants=payload.max_participants, status="open", created_at=utc_now(),
    )
    db.add(room)
    db.flush()
    db.add(models.RoomMember(room_id=room.id, user_id=current_user.id, role="host", status="active"))
    db.commit()
    db.refresh(room)
    return _out(db, room, current_user.id)


@router.get("")
def list_rooms(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    mine_ids = [m.room_id for m in db.query(models.RoomMember.room_id)
                .filter_by(user_id=current_user.id, status="active").all()]
    mine = (db.query(models.LearningRoom)
            .filter(models.LearningRoom.id.in_(mine_ids), models.LearningRoom.status != "closed")
            .order_by(models.LearningRoom.created_at.desc()).all()) if mine_ids else []
    public = (db.query(models.LearningRoom)
              .filter(models.LearningRoom.visibility == "public", models.LearningRoom.status == "open")
              .order_by(models.LearningRoom.created_at.desc()).limit(50).all())
    return {
        "mine": [_out(db, r, current_user.id, with_members=False) for r in mine],
        "public": [_out(db, r, current_user.id, with_members=False) for r in public if r.id not in set(mine_ids)],
    }


@router.get("/{code}")
def get_room(code: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    room = _room(db, code)
    m = _member(db, room, current_user.id)
    if m and m.status == "removed":
        raise HTTPException(status_code=403, detail="The host removed you from this room")
    return _out(db, room, current_user.id)


@router.post("/{code}/join")
def join_room(code: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    room = _room(db, code)
    m = _member(db, room, current_user.id)
    if m and m.status == "removed":
        raise HTTPException(status_code=403, detail="The host removed you from this room")
    if m and m.status == "active":
        return _out(db, room, current_user.id)
    if room.status == "locked":
        raise HTTPException(status_code=403, detail="The host has locked this room")
    if len(_active_members(db, room)) >= room.max_participants:
        raise HTTPException(status_code=409, detail="This room is full")
    if m:
        m.status, m.joined_at = "active", utc_now()
    else:
        db.add(models.RoomMember(room_id=room.id, user_id=current_user.id, role="member", status="active"))
    db.commit()
    return _out(db, room, current_user.id)


@router.post("/{code}/leave")
async def leave_room(code: str, current_user: models.User = Depends(auth.get_current_user),
                     db: Session = Depends(get_db)):
    room = _room(db, code)
    if room.host_id == current_user.id:
        raise HTTPException(status_code=400, detail="The host can't leave; close the room instead")
    m = _require_member(db, room, current_user.id)
    m.status = "left"
    db.commit()
    await hub.kick(room.id, current_user.id, "You left the room")
    await hub.broadcast(room.id, {"type": "members_changed"})
    return {"status": "left"}


@router.patch("/{code}")
async def update_room(code: str, payload: RoomUpdate, current_user: models.User = Depends(auth.get_current_user),
                      db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_host(room, current_user.id)
    for field in ("title", "description", "visibility", "status", "max_participants"):
        value = getattr(payload, field)
        if value is not None:
            setattr(room, field, value.strip() if isinstance(value, str) and field in ("title", "description") else value)
    db.commit()
    await hub.broadcast(room.id, {"type": "room_updated"})
    return _out(db, room, current_user.id)


@router.post("/{code}/remove/{user_id}")
async def remove_member(code: str, user_id: int, current_user: models.User = Depends(auth.get_current_user),
                        db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_host(room, current_user.id)
    if user_id == room.host_id:
        raise HTTPException(status_code=400, detail="The host can't remove themselves")
    m = _member(db, room, user_id)
    if not m or m.status != "active":
        raise HTTPException(status_code=404, detail="Not a member of this room")
    m.status = "removed"
    db.commit()
    await hub.kick(room.id, user_id, "The host removed you from this room")
    await hub.broadcast(room.id, {"type": "members_changed"})
    return {"status": "removed"}


@router.delete("/{code}")
async def close_room(code: str, current_user: models.User = Depends(auth.get_current_user),
                     db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_host(room, current_user.id)
    room.status = "closed"
    db.commit()
    for uid in list(hub.rooms.get(room.id, {})):
        await hub.kick(room.id, uid, "The host closed the room")
    hub.calls.pop(room.id, None)
    return {"status": "closed"}


@router.get("/{code}/messages")
def room_messages(code: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_member(db, room, current_user.id)
    rows = (db.query(models.RoomMessage).filter_by(room_id=room.id)
            .order_by(models.RoomMessage.id.desc()).limit(100).all())
    return [_message_out(m) for m in reversed(rows)]


def _message_out(m: models.RoomMessage) -> dict:
    return {"type": "chat", "id": m.id, "user_id": m.user_id, "name": m.user.name if m.user else "Member",
            "text": m.text, "created_at": m.created_at.isoformat() if m.created_at else None}


@router.get("/{code}/whiteboard", response_model=WhiteboardResponse)
def get_board(code: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_member(db, room, current_user.id)
    return {"state": room.whiteboard_state or "[]"}


@router.put("/{code}/whiteboard")
def save_board(code: str, payload: WhiteboardSaveRequest, current_user: models.User = Depends(auth.get_current_user),
               db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_member(db, room, current_user.id)
    room.whiteboard_state = payload.state
    db.commit()
    return {"status": "saved"}


def _code_state(room: models.LearningRoom) -> dict:
    try:
        s = json.loads(room.code_state or "{}")
        return s if isinstance(s, dict) else {}
    except ValueError:
        return {}


@router.get("/{code}/code", response_model=CompilerResponse)
def get_code(code: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_member(db, room, current_user.id)
    s = _code_state(room)
    if not s:
        return {"code": DEFAULT_CODE, "version": 0, "language": "python", "drafts": {}}
    return {"code": s.get("code", ""), "version": s.get("version", 0), "language": s.get("language", "python"),
            "drafts": s.get("drafts", {})}


@router.put("/{code}/code")
def save_code(code: str, payload: CompilerSaveRequest, current_user: models.User = Depends(auth.get_current_user),
              db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_member(db, room, current_user.id)
    s = _code_state(room)
    lang = payload.language or s.get("language") or "python"
    drafts = s.get("drafts") or {}
    drafts[lang] = payload.code
    s = {"code": payload.code, "language": lang, "drafts": drafts, "version": int(s.get("version", 0)) + 1}
    room.code_state = json.dumps(s)[:MAX_SHARED_CODE_CHARS * 5]
    db.commit()
    return {"status": "saved", "version": s["version"]}


@router.post("/{code}/run", response_model=RunResponse)
def run_code(code: str, payload: RunRequest, current_user: models.User = Depends(auth.get_current_user),
             db: Session = Depends(get_db)):
    room = _room(db, code)
    _require_member(db, room, current_user.id)
    now = time.monotonic()
    q = _recent_runs[current_user.id]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RUNS_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Slow down a little: too many runs in one minute.")
    q.append(now)
    r = run_program(payload.language, payload.code, payload.stdin)
    return RunResponse(output=r["output"] or "", error=r["error"], status=r["status"], sql=r["sql"], time_ms=r["time_ms"])


# ---------------------------------------------------------------------------
# WebSocket: chat, call signalling, live code and board
# ---------------------------------------------------------------------------
RELAY_TYPES = {"update_code", "execution_result", "update_elements", "reaction"}
SIGNAL_TYPES = {"offer", "answer", "candidate"}


def _save_chat(room_id: int, user_id: int, text: str) -> dict:
    db = SessionLocal()
    try:
        m = models.RoomMessage(room_id=room_id, user_id=user_id, text=text, created_at=utc_now())
        db.add(m)
        db.commit()
        db.refresh(m)
        return _message_out(m)
    finally:
        db.close()


@router.websocket("/ws/{code}")
async def room_socket(websocket: WebSocket, code: str, token: str = Query(...)):
    # Accept first, then authenticate and close with a specific code (CLAUDE.md rule).
    await websocket.accept()
    db = SessionLocal()
    try:
        user = auth.get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4401, reason="Not signed in")
            return
        room = db.query(models.LearningRoom).filter(models.LearningRoom.code == code).first()
        if not room or room.status == "closed":
            await websocket.close(code=4410, reason="Room closed")
            return
        m = _member(db, room, user.id)
        if not m or m.status != "active":
            await websocket.close(code=4403, reason="Not a member")
            return
        room_id, user_id, host_id, me = room.id, user.id, room.host_id, _person(user)
    finally:
        db.close()

    old = hub.add(room_id, user_id, websocket)
    if old is not None:
        try:
            await old.close(code=4409, reason="Opened in another tab")
        except Exception:
            pass
    call = hub.calls.get(room_id)
    await websocket.send_json({
        "type": "welcome", "you": me, "host_id": host_id,
        "online": list(hub.rooms.get(room_id, {})),
        "call": {"mode": call["mode"], "members": list(call["members"])} if call else None,
    })
    await hub.broadcast(room_id, {"type": "peer_joined", "user": me}, exclude=user_id)

    try:
        while True:
            data = await websocket.receive_json()
            if not isinstance(data, dict):
                continue
            kind = data.get("type")
            if kind == "ping":
                continue
            if kind == "chat":
                text = str(data.get("text") or "").strip()[:MAX_CHAT_CHARS]
                if text:
                    msg = await run_in_threadpool(_save_chat, room_id, user_id, text)
                    await hub.broadcast(room_id, msg)
            elif kind in SIGNAL_TYPES:
                to = data.get("to")
                if isinstance(to, int) and to in hub.rooms.get(room_id, {}):
                    await hub.send(room_id, to, {**data, "from": user_id})
            elif kind == "call_start":
                if user_id != host_id:
                    continue                       # only the host starts a call
                mode = "audio" if data.get("mode") == "audio" else "video"
                hub.calls[room_id] = {"mode": mode, "members": set()}
                await hub.broadcast(room_id, {"type": "call_started", "mode": mode, "by": user_id})
            elif kind == "call_join":
                call = hub.calls.get(room_id)
                if not call:
                    continue
                peers = [u for u in call["members"] if u != user_id]
                call["members"].add(user_id)
                # The newcomer calls everyone already in the call (no "glare").
                await websocket.send_json({"type": "call_peers", "peers": peers, "mode": call["mode"]})
                await hub.broadcast(room_id, {"type": "call_joined", "user_id": user_id}, exclude=user_id)
            elif kind == "call_leave":
                await hub.leave_call(room_id, user_id)
            elif kind == "call_end":
                if user_id == host_id and room_id in hub.calls:
                    hub.calls.pop(room_id, None)
                    await hub.broadcast(room_id, {"type": "call_ended"})
            elif kind in RELAY_TYPES:
                await hub.broadcast(room_id, data, exclude=user_id)
    except WebSocketDisconnect:
        pass
    except Exception as err:   # bad JSON or a dead socket: clean up below
        logger.warning("[rooms] socket error in room %s: %s", room_id, err)
    finally:
        if hub.remove(room_id, user_id, websocket):
            await hub.leave_call(room_id, user_id)
            asyncio.create_task(hub.broadcast(room_id, {"type": "peer_left", "user_id": user_id}))
