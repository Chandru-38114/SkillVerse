import os
from sqlalchemy import create_engine, text

DATABASE_URL = "sqlite:///backend/skillverse.db"
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start DATETIME;"))
        conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end DATETIME;"))
        print("[startup] Added scheduled_start and scheduled_end (DATETIME).")
    except Exception as e:
        print("Column add exception:", e)
        pass
    
    try:
        res = conn.execute(text("SELECT id, session_date, start_time, end_time FROM sessions WHERE scheduled_start IS NULL AND session_date IS NOT NULL"))
        import datetime as dt
        import pytz
        IST = pytz.timezone("Asia/Kolkata")
        for row in res.fetchall():
            sid, sdate, stime, etime = row[0], row[1], row[2], row[3]
            try:
                start_dt_naive = dt.datetime.strptime(f"{sdate} {stime}", "%Y-%m-%d %H:%M")
                end_dt_naive = dt.datetime.strptime(f"{sdate} {etime}", "%Y-%m-%d %H:%M")
                start_dt_ist = IST.localize(start_dt_naive)
                end_dt_ist = IST.localize(end_dt_naive)
                start_dt_utc = start_dt_ist.astimezone(dt.timezone.utc)
                end_dt_utc = end_dt_ist.astimezone(dt.timezone.utc)
                
                print(f"Migrating Session {sid}: {start_dt_naive} IST -> {start_dt_utc} UTC")
                conn.execute(
                    text("UPDATE sessions SET scheduled_start = :start, scheduled_end = :end WHERE id = :id"),
                    {"start": start_dt_utc, "end": end_dt_utc, "id": sid}
                )
            except Exception as e:
                print("Row migration error:", e)
    except Exception as e:
        print("Selection error:", e)

print("Migration script completed.")
