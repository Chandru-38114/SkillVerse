import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to add `from starlette.concurrency import run_in_threadpool`
if 'run_in_threadpool' not in content:
    content = content.replace(
        "from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query",
        "from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query\nfrom starlette.concurrency import run_in_threadpool"
    )

# Fix N+1 in get_inbox
new_get_inbox = """@router.get("/inbox", response_model=List[schemas.InboxConversationOut])
def get_inbox(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch requests where user is either from or to
    reqs = db.query(models.ConnectionRequest).filter(
        or_(
            models.ConnectionRequest.from_user_id == current_user.id,
            models.ConnectionRequest.to_user_id == current_user.id
        ),
        models.ConnectionRequest.status == 'accepted'
    ).all()
    
    if not reqs:
        return []

    req_ids = [r.id for r in reqs]
    other_user_ids = {r.to_user_id if r.from_user_id == current_user.id else r.from_user_id for r in reqs}
    skill_ids = {r.skill_id for r in reqs}

    users_map = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(other_user_ids)).all()}
    skills_map = {s.id: s for s in db.query(models.Skill).filter(models.Skill.id.in_(skill_ids)).all()}
    sessions_map = {s.request_id: s for s in db.query(models.Session).filter(models.Session.request_id.in_(req_ids)).all()}

    # Unread counts map
    unread_counts = db.query(
        models.Message.request_id, func.count(models.Message.id)
    ).filter(
        models.Message.request_id.in_(req_ids),
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False
    ).group_by(models.Message.request_id).all()
    unread_map = {row[0]: row[1] for row in unread_counts}

    # Latest messages map
    subq = db.query(
        models.Message.request_id, 
        func.max(models.Message.created_at).label('max_dt')
    ).filter(models.Message.request_id.in_(req_ids)).group_by(models.Message.request_id).subquery()
    
    latest_msgs = db.query(models.Message).join(
        subq,
        (models.Message.request_id == subq.c.request_id) & 
        (models.Message.created_at == subq.c.max_dt)
    ).all()
    latest_msg_map = {m.request_id: m for m in latest_msgs}
    
    inbox = []
    for req in reqs:
        other_user_id = req.to_user_id if req.from_user_id == current_user.id else req.from_user_id
        other_user = users_map.get(other_user_id)
        skill = skills_map.get(req.skill_id)
        
        latest_msg = latest_msg_map.get(req.id)
        unread_count = unread_map.get(req.id, 0)
        session = sessions_map.get(req.id)
        
        inbox.append(schemas.InboxConversationOut(
            request_id=req.id,
            other_user_id=other_user.id if other_user else other_user_id,
            other_user_name=other_user.name if other_user else "Unknown",
            other_user_avatar=other_user.profile_picture_url if (other_user and hasattr(other_user, 'profile_picture_url')) else None,
            skill_name=skill.name if skill else "Unknown",
            latest_message=latest_msg.content if latest_msg else ("Request " + req.status),
            latest_message_time=latest_msg.created_at if latest_msg else req.created_at,
            unread_count=unread_count,
            request_status=req.status,
            session_id=session.id if session else None,
            session_date=session.session_date if session else None,
            session_time=session.start_time if session else None,
            scheduled_start=session.scheduled_start if session else None,
            scheduled_end=session.scheduled_end if session else None
        ))
    
    # Sort by latest message time descending
    inbox.sort(key=lambda x: x.latest_message_time.timestamp() if x.latest_message_time else 0, reverse=True)
    return inbox"""

# Use regex to replace the old get_inbox with the new one
content = re.sub(
    r'@router\.get\("/inbox", response_model=List\[schemas\.InboxConversationOut\]\).*?return inbox\n',
    new_get_inbox + "\n",
    content,
    flags=re.DOTALL
)

# Now fix chat_websocket logic
new_ws_helpers = """def _ws_auth_and_authz(token: str, request_id: int):
    db = SessionLocal()
    try:
        user = _authenticate_ws(token, db)
        if not user:
            return None, 4401
        try:
            _authorize(db, request_id, user.id)
            return user, None
        except HTTPException:
            return None, 4403
    finally:
        db.close()

def _fetch_history(request_id: int):
    db_hist = SessionLocal()
    try:
        messages = db_hist.query(models.Message).filter(models.Message.request_id == request_id).order_by(models.Message.created_at).all()
        return [{
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.content,
            "created_at": enforce_utc_iso(m.created_at)
        } for m in messages]
    finally:
        db_hist.close()

def _save_message_and_notify(request_id: int, user_id: int, user_name: str, content: str):
    db_msg = SessionLocal()
    try:
        msg = models.Message(request_id=request_id, sender_id=user_id, content=content)
        db_msg.add(msg)
        db_msg.commit()
        db_msg.refresh(msg)
        req = db_msg.query(models.ConnectionRequest).filter(models.ConnectionRequest.id == request_id).first()
        if req:
            other_user_id = req.to_user_id if req.from_user_id == user_id else req.from_user_id
            create_notification(db_msg, other_user_id, "message", "New Message", f"{user_name} sent you a message", request_id, "chat")
        
        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "created_at": enforce_utc_iso(msg.created_at)
        }
    finally:
        db_msg.close()

@router.websocket("/ws/{request_id}")
async def chat_websocket(websocket: WebSocket, request_id: int, token: str = Query(...)):
    user, error_code = await run_in_threadpool(_ws_auth_and_authz, token, request_id)
    if error_code:
        await websocket.close(code=error_code)
        return

    await chat_manager.connect(request_id, websocket)
    
    # Send history immediately upon connection
    hist_messages = await run_in_threadpool(_fetch_history, request_id)
    await websocket.send_json({"type": "history", "messages": hist_messages})

    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue

            msg_payload = await run_in_threadpool(_save_message_and_notify, request_id, user.id, user.name, content)
            msg_payload["type"] = "message"
            await chat_manager.broadcast(request_id, msg_payload)
    except WebSocketDisconnect:
        chat_manager.disconnect(request_id, websocket)"""

content = re.sub(
    r'@router\.websocket\("/ws/\{request_id\}"\).*?chat_manager\.disconnect\(request_id, websocket\)',
    new_ws_helpers,
    content,
    flags=re.DOTALL
)

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Backend chat.py successfully rewritten.")
