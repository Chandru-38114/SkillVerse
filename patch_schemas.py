import re

with open('backend/app/schemas.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Update SessionCreate
session_create = """class SessionCreate(BaseModel):
    request_id:   int
    session_date: Optional[str] = None
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    scheduled_start: dt.datetime
    scheduled_end: dt.datetime
    notes:        Optional[str] = None"""
content = re.sub(r'class SessionCreate\(BaseModel\):.*?notes:\s*Optional\[str\] = None', session_create, content, flags=re.DOTALL)

# Update SessionOut
session_out = """class SessionOut(BaseModel):
    id:           int
    request_id:   int
    tutor_id:     int
    tutor_name:   str
    learner_id:   int
    learner_name: str
    skill:        str
    session_date: Optional[str] = None
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    scheduled_start: Optional[dt.datetime] = None
    scheduled_end: Optional[dt.datetime] = None
    status:       str
    notes:        Optional[str]
    request:      Optional[ConnectionRequestOut] = None
    created_at:   dt.datetime
    updated_at:   dt.datetime"""
content = re.sub(r'class SessionOut\(BaseModel\):.*?updated_at:\s*dt\.datetime', session_out, content, flags=re.DOTALL)

with open('backend/app/schemas.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("schemas.py updated.")
