"""Time helpers. The database stores UTC; India time (IST) is only for display."""
import datetime as dt
from datetime import timezone
from typing import Optional

import pytz

IST = pytz.timezone("Asia/Kolkata")


def utc_now() -> dt.datetime:
    """Returns the current timezone-aware UTC datetime."""
    return dt.datetime.now(timezone.utc)


def as_utc(value: Optional[dt.datetime]) -> Optional[dt.datetime]:
    """Make a datetime timezone-aware UTC. SQLite gives back naive datetimes
    (they were stored as UTC), so a naive value is treated as UTC. None stays None."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def enforce_utc_iso(dt_obj: dt.datetime) -> str:
    """Ensures a datetime object is serialized as an ISO-8601 string with UTC indicator (Z)."""
    if dt_obj is None:
        return None
    if dt_obj.tzinfo is None:
        dt_obj = dt_obj.replace(tzinfo=timezone.utc)
    # Using isoformat and explicitly ensuring Z for Javascript strict parsing
    return dt_obj.isoformat().replace("+00:00", "Z") if "+00:00" in dt_obj.isoformat() else dt_obj.isoformat() + "Z"
