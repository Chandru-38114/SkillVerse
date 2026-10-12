import re

with open('backend/app/schemas.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure Optional is imported
if 'from typing import ' in content and 'Optional' not in content:
    content = content.replace("from typing import ", "from typing import Optional, ")

old_msg_create = """class MessageCreate(BaseModel):
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="message_metadata", serialization_alias="metadata")"""

new_msg_create = """class MessageCreate(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)"""

content = content.replace(old_msg_create, new_msg_create)

with open('backend/app/schemas.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated MessageCreate in schemas.py")
