"""Session length helper."""
import datetime as dt


def session_minutes(session) -> int:
    """Length of a session in minutes, from its "HH:MM" start_time/end_time.
    A session that crosses midnight still counts correctly; 0 minutes or
    unreadable times count as 60."""
    try:
        start = dt.datetime.strptime(session.start_time, "%H:%M")
        end = dt.datetime.strptime(session.end_time, "%H:%M")
    except Exception:
        return 60
    minutes = int((end - start).total_seconds() / 60)
    if minutes < 0:
        minutes += 24 * 60
    return minutes or 60
