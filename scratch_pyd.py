from pydantic import BaseModel
import datetime as dt

class SessionCreate(BaseModel):
    scheduled_start: dt.datetime

m = SessionCreate(scheduled_start='2026-09-14T17:00:00.000Z')
print(repr(m.scheduled_start))
print(m.scheduled_start.tzinfo)
