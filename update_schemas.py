import re

with open('backend/app/schemas.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure Dict and Any are imported
if 'from typing import ' in content:
    if 'Dict' not in content:
        content = content.replace("from typing import ", "from typing import Dict, Any, ")
    if 'Any' not in content:
        content = content.replace("from typing import ", "from typing import Any, ")
        
if 'Field' not in content:
    content = content.replace("from pydantic import BaseModel, EmailStr", "from pydantic import BaseModel, EmailStr, Field")
    content = content.replace("from pydantic import BaseModel", "from pydantic import BaseModel, Field")

old_msg_create = """class MessageCreate(BaseModel):
    content: str"""

new_msg_create = """class MessageCreate(BaseModel):
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="message_metadata", serialization_alias="metadata")"""

old_msg_out = """class MessageOut(BaseModel):
    id: int
    sender_id: int
    content: str
    is_read: bool = False
    created_at: dt.datetime"""

new_msg_out = """class MessageOut(BaseModel):
    id: int
    sender_id: int
    content: str
    is_read: bool = False
    created_at: dt.datetime
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="message_metadata", serialization_alias="metadata")"""

content = content.replace(old_msg_create, new_msg_create)
content = content.replace(old_msg_out, new_msg_out)

with open('backend/app/schemas.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated schemas.py")
