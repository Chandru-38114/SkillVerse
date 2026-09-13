import re

with open('backend/app/routers/whiteboard.py', 'r', encoding='utf-8') as f:
    content = f.read()

if 'SessionLocal' not in content:
    content = content.replace('from ..database import get_db', 'from ..database import get_db, SessionLocal')

pattern = re.compile(r'@router\.websocket\("/{session_id}/whiteboard/ws"\)\s+async def whiteboard_websocket\(websocket: WebSocket, session_id: int, token: str, db: Session = Depends\(get_db\)\):(.*?)except WebSocketDisconnect:\s+manager\.disconnect\(session_id, user_id\)', re.DOTALL)

replacement = """@router.websocket("/{session_id}/whiteboard/ws")
async def whiteboard_websocket(websocket: WebSocket, session_id: int, token: str):
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

    await manager.connect(websocket, session_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(session_id, user_id, data)
    except WebSocketDisconnect:
        manager.disconnect(session_id, user_id)"""

content = pattern.sub(replacement, content)

with open('backend/app/routers/whiteboard.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("whiteboard.py patched")
