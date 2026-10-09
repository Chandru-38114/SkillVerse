"""Startup migration reproduction: creates a SQLite database with
assessment_sessions in its OLD production shape (no expires_at, violations or
terminated columns) plus one pre-existing row, boots the app via TestClient so
the startup migration in app/main.py runs, waits for its background thread,
and asserts the new columns appear, the old row survives with safe defaults,
and booting a second time is idempotent."""
import sqlite3
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from _common import setup_backend_env, Report  # noqa: E402

db_path = setup_backend_env("migration.db")

# Build the OLD-shape table BEFORE the app ever touches this database file,
# so the startup migration has real legacy data to upgrade.
_conn = sqlite3.connect(str(db_path))
_conn.execute(
    """
    CREATE TABLE assessment_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        skill_name TEXT,
        source TEXT,
        questions TEXT,
        created_at TIMESTAMP,
        submitted_at TIMESTAMP
    )
    """
)
_conn.execute(
    "INSERT INTO assessment_sessions (id, user_id, skill_name, source, questions, created_at, submitted_at) "
    "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ("legacy-1", 1, "Python", "ai", '[{"id": "legacy-q1", "type": "mcq"}]', "2025-01-01 00:00:00", None),
)
_conn.commit()
_conn.close()

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import inspect as sa_inspect  # noqa: E402
from app.database import engine  # noqa: E402
import app.main as app_main  # noqa: E402

ORIGINAL_COLS = {"id", "user_id", "skill_name", "source", "questions", "created_at", "submitted_at"}
NEW_COLS = {"expires_at", "violations", "terminated"}


def wait_for_columns(required: set, timeout: float = 15.0, interval: float = 0.3) -> set:
    deadline = time.time() + timeout
    cols: set = set()
    while time.time() < deadline:
        insp = sa_inspect(engine)
        if insp.has_table("assessment_sessions"):
            cols = {c["name"] for c in insp.get_columns("assessment_sessions")}
            if required <= cols:
                return cols
        time.sleep(interval)
    return cols


def row_for_legacy_1():
    conn = sqlite3.connect(str(db_path))
    row = conn.execute(
        "SELECT id, user_id, skill_name, source, violations, terminated, submitted_at "
        "FROM assessment_sessions WHERE id = ?",
        ("legacy-1",),
    ).fetchone()
    count = conn.execute("SELECT COUNT(*) FROM assessment_sessions").fetchone()[0]
    conn.close()
    return row, count


def main() -> bool:
    r = Report("Startup migration (assessment_sessions)")

    # ---- First boot: migration must run and upgrade the legacy table ------
    with TestClient(app_main.app):
        cols_after_first_boot = wait_for_columns(NEW_COLS)

    r.check(
        "first boot adds expires_at/violations/terminated",
        NEW_COLS <= cols_after_first_boot,
        f"columns={cols_after_first_boot}",
    )
    r.check(
        "original columns survive the migration",
        ORIGINAL_COLS <= cols_after_first_boot,
        f"columns={cols_after_first_boot}",
    )

    row, count = row_for_legacy_1()
    r.check("pre-existing row survived", row is not None, f"row={row}")
    if row:
        _id, user_id, skill_name, source, violations, terminated, submitted_at = row
        r.check("row keeps its original id/skill_name/source", (_id, skill_name, source) == ("legacy-1", "Python", "ai"))
        r.check("new violations column defaults to 0", violations == 0, f"violations={violations}")
        r.check("new terminated column defaults to false", terminated in (0, False), f"terminated={terminated}")
        r.check("submitted_at is still null (never submitted)", submitted_at is None, f"submitted_at={submitted_at}")
    r.check("exactly one row after first boot", count == 1, f"count={count}")

    # ---- Second boot: must be safe, no duplication or data loss -----------
    with TestClient(app_main.app):
        cols_after_second_boot = wait_for_columns(NEW_COLS, timeout=5.0)
        time.sleep(1.0)  # give the (no-op) ALTER-skip branch time to run

    row2, count2 = row_for_legacy_1()
    r.check(
        "second boot: column set unchanged (no duplicate columns)",
        cols_after_second_boot == cols_after_first_boot,
        f"first={cols_after_first_boot} second={cols_after_second_boot}",
    )
    r.check("second boot: still exactly one row", count2 == 1, f"count={count2}")
    r.check("second boot: row values unchanged", row2 == row, f"first={row} second={row2}")

    return r.summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
