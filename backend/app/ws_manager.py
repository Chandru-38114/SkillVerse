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