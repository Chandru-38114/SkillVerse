import re

with open('backend/app/routers/sessions.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("from sqlalchemy.orm import Session\nfrom ..notification_service import create_notification as DBSession",
                          "from sqlalchemy.orm import Session as DBSession\nfrom ..notification_service import create_notification")

with open('backend/app/routers/sessions.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed sessions.py")
