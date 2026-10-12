import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("m.created_at.isoformat()", "enforce_utc_iso(m.created_at)")
content = content.replace("msg.created_at.isoformat()", "enforce_utc_iso(msg.created_at)")

if "enforce_utc_iso" not in content:
    content = content.replace("from fastapi import", "from ..utils.timezone import enforce_utc_iso\nfrom fastapi import")

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)
