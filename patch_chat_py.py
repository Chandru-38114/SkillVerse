import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'@router\.websocket\("/ws/{request_id}"\)\s+async def chat_websocket\(websocket: WebSocket, request_id: int, token: str = Query\(\.\.\.\)\):(.*?)except WebSocketDisconnect:\s+chat_manager\.disconnect\(request_id, websocket\)\s+finally:\s+db\.close\(\)', re.DOTALL)

replacement = """@router.websocket("/ws/{request_id}")
async def chat_websocket(websocket: WebSocket, request_id: int, token: str = Query(...)):
    db = SessionLocal()
    try:
        user = _authenticate_ws(token, db)
        if not user:
            await websocket.close(code=4401)  # custom code: unauthenticated
            return
        try:
            _authorize(db, request_id, user.id)
        except HTTPException:
            await websocket.close(code=4403)  # custom code: forbidden
            return
    finally:
        db.close()

    await chat_manager.connect(request_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue

            db_msg = SessionLocal()
            try:
                msg = models.Message(request_id=request_id, sender_id=user.id, content=content)
                db_msg.add(msg)
                db_msg.commit()
                db_msg.refresh(msg)
                req = db_msg.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
                other_user_id = req.to_user_id if req.from_user_id == user.id else req.from_user_id
                create_notification(db_msg, other_user_id, "message", "New Message", f"{user.name} sent you a message", request_id, "chat")
                msg_id = msg.id
                msg_sender = msg.sender_id
                msg_content = msg.content
                msg_created = msg.created_at.isoformat()
            finally:
                db_msg.close()

            await chat_manager.broadcast(request_id, {
                "type": "message",
                "id": msg_id,
                "sender_id": msg_sender,
                "content": msg_content,
                "created_at": msg_created,
            })
    except WebSocketDisconnect:
        chat_manager.disconnect(request_id, websocket)"""

content = pattern.sub(replacement, content)

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("chat.py patched")
