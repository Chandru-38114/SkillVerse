import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """    await chat_manager.connect(request_id, websocket)
    
    # Send history immediately upon connection
    db_hist = SessionLocal()
    try:
        messages = db_hist.query(models.Message).filter(models.Message.request_id == request_id).order_by(models.Message.created_at).all()
        history_payload = {
            "type": "history",
            "messages": [{
                "id": m.id,
                "sender_id": m.sender_id,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            } for m in messages]
        }
        await websocket.send_json(history_payload)
    finally:
        db_hist.close()

    try:"""

content = content.replace("    await chat_manager.connect(request_id, websocket)\n    try:", replacement)

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("chat.py patched with history payload")
