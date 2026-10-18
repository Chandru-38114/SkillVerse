"""
In-memory WebSocket "rooms".

- chat_manager      one room per connection request (the two chat partners)
- SessionRoomManager one room per learning session, one socket per user.
  Used three times: video signalling (webrtc_manager here), the shared code
  editor (routers/compiler.py) and the whiteboard (routers/whiteboard.py).

Everything lives in this process's memory, which is fine for a single
Uvicorn worker. With several workers, swap the dicts for Redis pub/sub and
keep the same methods.
"""
from typing import Dict, List, Optional

from fastapi import WebSocket


class ConnectionManager:
    """Chat rooms keyed by the connection request id. A user may have several
    tabs open, so a room holds a list of sockets."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket, accept: bool = True) -> None:
        if accept:
            await websocket.accept()
        self.active_connections.setdefault(room_id, []).append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        conns = self.active_connections.get(room_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict) -> None:
        dead = []
        for connection in self.active_connections.get(room_id, []):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(room_id, connection)

    def room_size(self, room_id: str) -> int:
        return len(self.active_connections.get(room_id, []))


chat_manager = ConnectionManager()


class SessionRoomManager:
    """Learning-session rooms: session_id -> {user_id: websocket}.
    A user reconnecting replaces their old socket."""

    def __init__(self):
        self.rooms: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, session_id: int, user_id: int, websocket: WebSocket, accept: bool = True) -> None:
        if accept:
            await websocket.accept()
        self.rooms.setdefault(session_id, {})[user_id] = websocket

    def disconnect(self, session_id: int, user_id: int, websocket: Optional[WebSocket] = None) -> None:
        """Remove the user from the room. When `websocket` is given and the user
        has already reconnected (the room holds their NEW socket), do nothing,
        so closing the old socket doesn't remove the new one."""
        room = self.rooms.get(session_id)
        if not room or user_id not in room:
            return
        if websocket is not None and room[user_id] is not websocket:
            return
        del room[user_id]
        if not room:
            del self.rooms[session_id]

    async def send_to_peer(self, session_id: int, sender_id: int, message: dict) -> None:
        """Send a JSON message to everyone in the room except the sender."""
        room = self.rooms.get(session_id)
        if not room:
            return
        dead = []
        for uid, connection in room.items():
            if uid != sender_id:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead.append(uid)
        for uid in dead:
            del room[uid]
        if not room:
            del self.rooms[session_id]

    async def broadcast_text(self, session_id: int, sender_id: int, message: str) -> None:
        """Send raw text to everyone in the room except the sender."""
        for uid, connection in list(self.rooms.get(session_id, {}).items()):
            if uid != sender_id:
                try:
                    await connection.send_text(message)
                except Exception:
                    self.disconnect(session_id, uid)


webrtc_manager = SessionRoomManager()
