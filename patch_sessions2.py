import re

with open('backend/app/routers/sessions.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''def _validate_times(start: dt.datetime, end: dt.datetime):
    """Raise 422 for obviously invalid date/time combinations."""
    if start >= end:
        raise HTTPException(status_code=422, detail="Start time must be before end time.")
    from ..utils.timezone import utc_now
    # We allow scheduling slightly in the past (e.g. starting a session right now)
    if start < utc_now() - dt.timedelta(hours=1):
        raise HTTPException(status_code=422, detail="Session cannot be scheduled too far in the past.")'''

content = re.sub(r'def _validate_times\(start: dt\.datetime, end: dt\.datetime\):.*?raise HTTPException\(status_code=422, detail="Session cannot be scheduled too far in the past."\)', replacement, content, flags=re.DOTALL)

with open('backend/app/routers/sessions.py', 'w', encoding='utf-8') as f:
    f.write(content)
