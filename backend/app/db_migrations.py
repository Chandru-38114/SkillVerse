"""
Startup database checks — runs once when the server starts (see main.py).

1. `Base.metadata.create_all` creates every table that doesn't exist yet.
2. `create_all` never changes an EXISTING table, so columns that were added
   to models.py after a table was first created are added here with
   ALTER TABLE ... ADD COLUMN (listed in NEW_COLUMNS).
3. Two small data fixes for old rows (old session times, missing level_num).

Nothing here deletes or renames data, so it is safe to run on production
every time the server starts.

To add a new column to an existing table: add the column to models.py AND
add a line to NEW_COLUMNS below.
"""
import datetime as dt
import logging
import time

import pytz
from sqlalchemy import inspect, text

from .database import Base, engine
from . import models  # noqa: F401  (registers every table on Base before create_all)

logger = logging.getLogger(__name__)

# Postgres (production) uses the first type; SQLite (local dev) falls back
# to the next one if the first is refused.
TIMESTAMP_TYPES = ("TIMESTAMP WITH TIME ZONE", "DATETIME")

# (table, column, SQL types to try in order)
NEW_COLUMNS = [
    ("sessions", "scheduled_start", TIMESTAMP_TYPES),
    ("sessions", "scheduled_end", TIMESTAMP_TYPES),
    ("sessions", "started_at", TIMESTAMP_TYPES),
    ("sessions", "both_joined_at", TIMESTAMP_TYPES),
    ("user_skills", "course_completed_at", TIMESTAMP_TYPES),
    ("users", "dob", ("VARCHAR",)),
    ("users", "gender", ("VARCHAR",)),
    ("reviews", "session_id", ("INTEGER REFERENCES sessions(id) NULL",)),
    ("session_progress", "semantic_summary", ("TEXT NULL",)),
    ("session_progress", "next_session_plan", ("TEXT",)),
    ("assessment_sessions", "expires_at", TIMESTAMP_TYPES),
    ("assessment_sessions", "violations", ("INTEGER NOT NULL DEFAULT 0",)),
    ("assessment_sessions", "terminated", ("BOOLEAN NOT NULL DEFAULT FALSE",)),
    ("assessment_sessions", "session_id", ("INTEGER REFERENCES sessions(id) NULL", "INTEGER")),
    ("user_skills", "level_num", ("INTEGER NOT NULL DEFAULT 0",)),
    ("connection_requests", "points_awarded", ("BOOLEAN NOT NULL DEFAULT FALSE",)),
]


def _missing_columns(inspector) -> list:
    """The NEW_COLUMNS entries whose column isn't in the database yet."""
    existing = {}
    missing = []
    for table, column, types in NEW_COLUMNS:
        if table not in existing:
            existing[table] = (
                {c["name"] for c in inspector.get_columns(table)} if inspector.has_table(table) else set()
            )
        if column not in existing[table]:
            missing.append((table, column, types))
    return missing


def _add_column(conn, table: str, column: str, types) -> None:
    for col_type in types:
        try:
            with conn.begin():
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type};"))
            logger.info("[startup] Added %s.%s (%s).", table, column, col_type)
            return
        except Exception as e:
            logger.warning("[startup] Could not add %s.%s as %s: %s", table, column, col_type, e)


def _fill_old_session_times(conn) -> None:
    """Very old sessions only stored date + "HH:MM" text in India time.
    Fill scheduled_start / scheduled_end (UTC) for them."""
    ist = pytz.timezone("Asia/Kolkata")
    try:
        with conn.begin():
            rows = conn.execute(text(
                "SELECT id, session_date, start_time, end_time FROM sessions "
                "WHERE scheduled_start IS NULL AND session_date IS NOT NULL"
            )).fetchall()
            for sid, sdate, stime, etime in rows:
                try:
                    start = ist.localize(dt.datetime.strptime(f"{sdate} {stime}", "%Y-%m-%d %H:%M"))
                    end = ist.localize(dt.datetime.strptime(f"{sdate} {etime}", "%Y-%m-%d %H:%M"))
                    conn.execute(
                        text("UPDATE sessions SET scheduled_start = :start, scheduled_end = :end WHERE id = :id"),
                        {"start": start.astimezone(dt.timezone.utc), "end": end.astimezone(dt.timezone.utc), "id": sid},
                    )
                except Exception as e:
                    logger.warning("[startup] Failed to migrate session row %s: %s", sid, e)
    except Exception:
        pass


def _fill_missing_level_num() -> None:
    """Rows assessed before level_num existed: work it out from latest_score."""
    from .utils.levels import score_to_level
    try:
        # One transaction for the SELECT and the UPDATEs.
        with engine.begin() as conn:
            rows = conn.execute(text(
                "SELECT id, latest_score FROM user_skills "
                "WHERE (level_num = 0 OR level_num IS NULL) AND latest_score IS NOT NULL"
            )).fetchall()
            for row_id, score in rows:
                conn.execute(
                    text("UPDATE user_skills SET level_num = :lvl WHERE id = :id"),
                    {"lvl": score_to_level(score), "id": row_id},
                )
            if rows:
                logger.info("[startup] Backfilled level_num from latest_score for %d user_skills rows.", len(rows))
    except Exception as e:
        logger.warning("[startup] level_num backfill skipped/failed: %s", e)


def run_startup_migrations() -> None:
    """Create missing tables, add missing columns, fix old rows."""
    started = time.perf_counter()
    try:
        Base.metadata.create_all(engine)
        missing = _missing_columns(inspect(engine))

        if missing:
            with engine.connect() as conn:
                for table, column, types in missing:
                    _add_column(conn, table, column, types)
                _fill_old_session_times(conn)

        _fill_missing_level_num()

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        if missing:
            logger.info("[startup] Database startup checks completed in %.1fms.", elapsed_ms)
        else:
            logger.info("[startup] Database schema verified and up-to-date in %.1fms; skipped migrations.", elapsed_ms)
    except Exception as e:
        logger.error("[startup] Database schema creation failed: %s", e)
