"""
In-memory connection manager for chat WebSockets.

Rooms are keyed by connection_request_id — one room per accepted connection
between two users. This is process-local (fine for a single uvicorn worker
during Phase 2); if you scale to multiple workers/processes later, swap the
in-memory dict for a Redis pub/sub backend and keep this same interface.
"""
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, room_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(room_id, []).append(websocket)

    def disconnect(self, room_id: int, websocket: WebSocket) -> None:
        conns = self.active_connections.get(room_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(room_id, None)

    async def broadcast(self, room_id: int, message: dict) -> None:
        dead = []
        for connection in self.active_connections.get(room_id, []):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(room_id, connection)

    def room_size(self, room_id: int) -> int:
        return len(self.active_connections.get(room_id, []))


chat_manager = ConnectionManager()


class WebRTCManager:
    def __init__(self):
        # session_id -> { user_id -> WebSocket }
        self.rooms: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, session_id: int, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        if session_id not in self.rooms:
            self.rooms[session_id] = {}
        self.rooms[session_id][user_id] = websocket

    def disconnect(self, session_id: int, user_id: int) -> None:
        room = self.rooms.get(session_id)
        if room and user_id in room:
            del room[user_id]
            if not room:
                del self.rooms[session_id]

    async def send_to_peer(self, session_id: int, sender_id: int, message: dict) -> None:
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
        if room and not self.rooms[session_id]: # Cleanup if empty
            del self.rooms[session_id]


webrtc_manager = WebRTCManager()