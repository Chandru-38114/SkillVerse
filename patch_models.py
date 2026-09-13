import re

with open('backend/app/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace dt.datetime.utcnow with utc_now
content = content.replace("default=dt.datetime.utcnow", "default=utc_now")
content = content.replace("onupdate=dt.datetime.utcnow", "onupdate=utc_now")

# Import utc_now
if "from .utils.timezone import utc_now" not in content:
    content = content.replace("import datetime as dt\nfrom sqlalchemy import", "import datetime as dt\nfrom .utils.timezone import utc_now\nfrom sqlalchemy import")

# Add scheduled_start and scheduled_end to Session
session_cols = """
    session_date = Column(String, nullable=False)   # ISO date string: "YYYY-MM-DD"
    start_time   = Column(String, nullable=False)   # "HH:MM"
    end_time     = Column(String, nullable=False)   # "HH:MM"
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
"""
content = re.sub(r'session_date = Column\(String, nullable=False\).*?end_time\s*= Column\(String, nullable=False\).*?# "HH:MM"', session_cols.strip(), content, flags=re.DOTALL)

with open('backend/app/models.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("models.py updated.")
