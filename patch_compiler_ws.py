import re

with open('backend/app/routers/compiler.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add SessionLocal import if missing
if 'SessionLocal' not in content:
    content = content.replace('from ..database import get_db', 'from ..database import get_db, SessionLocal')

# Replace compiler_websocket
pattern = re.compile(r'@router\.websocket\("/{session_id}/ws"\)\s+async def compiler_websocket\(websocket: WebSocket, session_id: int, token: str, db: Session = Depends\(get_db\)\):(.*?)compiler_manager\.disconnect\(session_id, user_id\)', re.DOTALL)

replacement = """@router.websocket("/{session_id}/ws")
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
                        db_loop.refresh(comp)
                        c_code = comp.code
                        c_version = comp.version
                    finally:
                        db_loop.close()
                        
                    # Broadcast the event with version
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "update_code",
                        "code": c_code,
                        "version": c_version
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
        compiler_manager.disconnect(session_id, user_id)"""

content = pattern.sub(replacement, content)

with open('backend/app/routers/compiler.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("compiler.py patched")
