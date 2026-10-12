from pydantic import BaseModel
import datetime as dt
from datetime import timezone

def utc_now():
    return dt.datetime.now(timezone.utc)

class SessionCreate(BaseModel):
    scheduled_start: dt.datetime

m = SessionCreate(scheduled_start='2026-09-14T17:00:00.000Z')
start = m.scheduled_start
limit = utc_now() - dt.timedelta(hours=1)
print(f"start: {start} (tz: {start.tzinfo})")
print(f"limit: {limit} (tz: {limit.tzinfo})")
print(f"start < limit: {start < limit}")
