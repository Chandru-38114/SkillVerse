import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("from ..database import get_supabase", "from ..supabase_client import get_supabase")

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
