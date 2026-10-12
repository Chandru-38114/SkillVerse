from sqlalchemy import Column, Integer, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()

try:
    class Message(Base):
        __tablename__ = 'messages'
        id = Column(Integer, primary_key=True)
        metadata = Column(JSON)
    print("Success. Table columns:", Message.__table__.columns.keys())
    print("Message metadata type:", type(Message.metadata))
except Exception as e:
    print("Error:", e)
