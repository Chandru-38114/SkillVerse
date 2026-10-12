import re

with open('backend/app/routers/sessions.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'@router\.websocket\("/ws/{session_id}"\)\s+async def webrtc_signaling\(\s+websocket: WebSocket,\s+session_id: int,\s+token: str = Query\(\.\.\.\)\s+\):(.*?)except WebSocketDisconnect:\s+pass\s+finally:\s+enforcer\.cancel\(\)\s+webrtc_manager\.disconnect\(session_id, user_id\)(.*?)\n\s+finally:\s+db\.close\(\)\n?', re.DOTALL)

replacement = """@router.websocket("/ws/{session_id}")
async def webrtc_signaling(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(...)
):
    db = SessionLocal()
    try:
        user = _authenticate_ws(token, db)
        if not user:
            await websocket.close(code=1008)
            return
        
        s = db.query(models.Session).filter(models.Session.id == session_id).first()
        if not s or user.id not in (s.tutor_id, s.learner_id):
            await websocket.close(code=1008)
            return
            
        if s.status != "scheduled":
            await websocket.close(code=1008)
            return

        import asyncio
        end_dt = dt.datetime.strptime(f"{s.session_date} {s.end_time}", "%Y-%m-%d %H:%M")
        
        if dt.datetime.now() >= end_dt:
            s.status = "completed"
            db.commit()
            await websocket.close(code=1008, reason="Session Ended")
            return
    finally:
        db.close()

    # Connect user
    await webrtc_manager.connect(session_id, user.id, websocket)

    # Notify peer that user joined
    await webrtc_manager.send_to_peer(session_id, user.id, {
        "type": "peer_joined",
        "user_id": user.id
    })

    async def enforce_end():
        while True:
            now = dt.datetime.now()
            if now >= end_dt:
                db_end = SessionLocal()
                try:
                    s_end = db_end.query(models.Session).filter(models.Session.id == session_id).first()
                    if s_end and s_end.status != "completed":
                        s_end.status = "completed"
                        db_end.commit()
                finally:
                    db_end.close()
                try:
                    await websocket.close(code=1008, reason="Session Ended")
                except Exception:
                    pass
                break
            await asyncio.sleep(min(max((end_dt - now).total_seconds(), 0.1), 10))

    enforcer = asyncio.create_task(enforce_end())

    try:
        while True:
            data = await websocket.receive_json()
            # For WebRTC, just relay to the other participant
            await webrtc_manager.send_to_peer(session_id, user.id, data)
    except WebSocketDisconnect:
        pass
    finally:
        enforcer.cancel()
        webrtc_manager.disconnect(session_id, user.id)
        # Try to notify peer if still possible
        asyncio.create_task(webrtc_manager.send_to_peer(session_id, user.id, {
            "type": "peer_left",
            "user_id": user.id
        }))
"""

content = pattern.sub(replacement, content)

with open('backend/app/routers/sessions.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("sessions.py patched")
