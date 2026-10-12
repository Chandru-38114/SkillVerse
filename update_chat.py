import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Update send_message
old_send_msg = """    msg = models.Message(request_id=request_id, sender_id=current_user.id, content=payload.content)"""
new_send_msg = """    msg = models.Message(request_id=request_id, sender_id=current_user.id, content=payload.content, message_metadata=payload.metadata)"""
content = content.replace(old_send_msg, new_send_msg)

# Update _fetch_history
old_fetch = """        return [{
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.content,
            "created_at": enforce_utc_iso(m.created_at)
        } for m in messages]"""

new_fetch = """        return [{
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.content,
            "created_at": enforce_utc_iso(m.created_at),
            "metadata": m.message_metadata
        } for m in messages]"""
content = content.replace(old_fetch, new_fetch)

# Update _save_message_and_notify signature and logic
old_save_sig = """def _save_message_and_notify(request_id: int, user_id: int, user_name: str, content: str):"""
new_save_sig = """def _save_message_and_notify(request_id: int, user_id: int, user_name: str, content: str, metadata: dict = None):"""
content = content.replace(old_save_sig, new_save_sig)

old_save_msg = """    try:
        msg = models.Message(request_id=request_id, sender_id=user_id, content=content)"""
new_save_msg = """    try:
        msg = models.Message(request_id=request_id, sender_id=user_id, content=content, message_metadata=metadata or {})"""
content = content.replace(old_save_msg, new_save_msg)

old_save_ret = """        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "created_at": enforce_utc_iso(msg.created_at)
        }"""
new_save_ret = """        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "created_at": enforce_utc_iso(msg.created_at),
            "metadata": msg.message_metadata
        }"""
content = content.replace(old_save_ret, new_save_ret)

# Update websocket loop
old_ws_loop = """            content = (data.get("content") or "").strip()
            if not content:
                continue

            msg_payload = await run_in_threadpool(_save_message_and_notify, request_id, user.id, user.name, content)"""
new_ws_loop = """            content = (data.get("content") or "").strip()
            metadata = data.get("metadata", {})
            if not content and not metadata:
                continue

            msg_payload = await run_in_threadpool(_save_message_and_notify, request_id, user.id, user.name, content, metadata)"""
content = content.replace(old_ws_loop, new_ws_loop)

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated chat.py")
