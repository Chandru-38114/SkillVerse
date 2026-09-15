import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_migration_pattern = re.compile(
    r'# Manual safe migration for timezone handling.*?except Exception as e:\s*print\("\[startup\] Migration error:", e\)',
    re.DOTALL
)

new_migration = """# Manual safe migration for timezone handling (scheduled_start, scheduled_end)
            with engine.connect() as conn:
                try:
                    with conn.begin():
                        conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start TIMESTAMP WITH TIME ZONE;"))
                        conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end TIMESTAMP WITH TIME ZONE;"))
                    print("[startup] Added scheduled_start and scheduled_end (TIMESTAMP WITH TIME ZONE).")
                except Exception as e:
                    print(f"[startup] Note: scheduled_start/end TIMESTAMP migration skipped/failed: {e}")

                try:
                    with conn.begin():
                        conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start DATETIME;"))
                        conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end DATETIME;"))
                    print("[startup] Added scheduled_start and scheduled_end (DATETIME).")
                except Exception as e:
                    print(f"[startup] Note: scheduled_start/end DATETIME migration skipped/failed: {e}")
                
                try:
                    with conn.begin():
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
                    print("[startup] Migration error on data conversion:", e)"""

text = old_migration_pattern.sub(new_migration, text)

old_user_migration_pattern = re.compile(
    r'# Manual safe migration for existing DBs that lack dob/gender.*?except Exception:\s*pass\s*# column likely exists',
    re.DOTALL
)

new_user_migration = """# Manual safe migration for existing DBs that lack dob/gender
            with engine.connect() as conn:
                try:
                    with conn.begin():
                        conn.execute(text("ALTER TABLE users ADD COLUMN dob VARCHAR;"))
                    print("[startup] Added dob column.")
                except Exception as e:
                    print(f"[startup] Note: Added dob column skipped/failed (likely exists): {e}")
                    
                try:
                    with conn.begin():
                        conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR;"))
                    print("[startup] Added gender column.")
                except Exception as e:
                    print(f"[startup] Note: Added gender column skipped/failed (likely exists): {e}")"""

text = old_user_migration_pattern.sub(new_user_migration, text)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Migration replacement done")
