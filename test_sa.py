from sqlalchemy import Column, Integer, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True)
    metadata_ = Column("metadata", JSON)

print(Message.__table__.columns.keys())
