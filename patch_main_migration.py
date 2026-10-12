import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

migration_logic = """
            # Manual safe migration for timezone handling (scheduled_start, scheduled_end)
            with engine.begin() as conn:
                try:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start TIMESTAMP WITH TIME ZONE;"))
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end TIMESTAMP WITH TIME ZONE;"))
                    print("[startup] Added scheduled_start and scheduled_end (TIMESTAMP WITH TIME ZONE).")
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start DATETIME;"))
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end DATETIME;"))
                    print("[startup] Added scheduled_start and scheduled_end (DATETIME).")
                except Exception:
                    pass
                
                try:
                    # Data conversion for existing sessions assuming Asia/Kolkata
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
                            conn.execute(
                                text("UPDATE sessions SET scheduled_start = :start, scheduled_end = :end WHERE id = :id"),
                                {"start": start_dt_utc, "end": end_dt_utc, "id": sid}
                            )
                        except Exception as e:
                            print("[startup] Failed to migrate session row:", sid, e)
                except Exception as e:
                    print("[startup] Migration error:", e)

            # Manual safe migration for existing DBs that lack dob/gender
"""

content = content.replace("# Manual safe migration for existing DBs that lack dob/gender", migration_logic)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("main.py patched with timezone migration logic")
