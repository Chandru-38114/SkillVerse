import datetime as dt
from pydantic import BaseModel
class M(BaseModel):
    d: dt.datetime

val = M(d='2026-09-14T17:00:00.000Z')
print(repr(val.d))
print(val.d < dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1))
