import re

with open('backend/app/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

if ' JSON,' not in content and ' JSON ' not in content:
    content = content.replace(
        "Column, Integer, String, Float, ForeignKey, DateTime, Date, Text, Boolean",
        "Column, Integer, String, Float, ForeignKey, DateTime, Date, Text, Boolean, JSON, Index"
    )

old_message_class = """class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("connection_requests.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)"""

new_message_class = """class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("connection_requests.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    message_metadata = Column("metadata", JSON, nullable=False, default=dict)

    __table_args__ = (
        Index("ix_messages_request_id_created_at", "request_id", "created_at"),
    )"""

content = content.replace(old_message_class, new_message_class)

with open('backend/app/models.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated models.py")
