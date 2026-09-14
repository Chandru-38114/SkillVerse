from sqlalchemy import Column, Integer, JSON
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel, ConfigDict, Field
from typing import Dict, Any

Base = declarative_base()

class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True)
    message_metadata = Column("metadata", JSON, default=dict)

class MessageOut(BaseModel):
    id: int
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="message_metadata", serialization_alias="metadata")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

m = Message(id=1, message_metadata={"foo": "bar"})
out = MessageOut.model_validate(m)
print(out.model_dump(by_alias=True))
