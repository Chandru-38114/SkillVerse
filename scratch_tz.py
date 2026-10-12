import datetime as dt
from datetime import timezone
import pytz

def utc_now() -> dt.datetime:
    return dt.datetime.now(timezone.utc)

start_str = '2026-09-14T17:00:00.000Z'
# simulate pydantic parsing
# Actually pydantic parses ISO8601 with Z
start = dt.datetime.fromisoformat(start_str.replace('Z', '+00:00'))

print("start:", start)
print("utc_now:", utc_now())
print("start < utc_now - 1h:", start < utc_now() - dt.timedelta(hours=1))

