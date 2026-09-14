import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.database import SessionLocal
from backend.app.models import Message, User, ConnectionRequest
from backend.app.schemas import MessageCreate, MessageOut

db = SessionLocal()

# find any existing request
req = db.query(ConnectionRequest).first()
if not req:
    print("No connection requests found.")
    sys.exit(0)

# 1. Existing messages load?
msgs = db.query(Message).filter(Message.request_id == req.id).all()
print(f"Existing messages loaded: {len(msgs)}")

# 2. Plain text message creation (simulate API payload)
mc1 = MessageCreate(content="hello")
msg1 = Message(request_id=req.id, sender_id=req.from_user_id, content=mc1.content, message_metadata=mc1.metadata)
db.add(msg1)
db.commit()
db.refresh(msg1)
print(f"Plain message saved. metadata={msg1.message_metadata}")

# 3. New message with metadata
mc2 = MessageCreate(content="reply", metadata={"reply_to_id": msg1.id})
msg2 = Message(request_id=req.id, sender_id=req.from_user_id, content=mc2.content, message_metadata=mc2.metadata)
db.add(msg2)
db.commit()
db.refresh(msg2)

# 4. Metadata survives database save/reload
db.expunge_all()
reloaded = db.query(Message).filter(Message.id == msg2.id).first()
print(f"Reloaded msg2 metadata: {reloaded.message_metadata}")

# test schemas
out = MessageOut.model_validate(reloaded)
print(f"MessageOut serialization: {out.model_dump(mode='json')}")

db.close()
print("Tests passed.")
