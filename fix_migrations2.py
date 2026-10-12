import re

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the manual safe migration section
old_block_pattern = re.compile(r'# Manual safe migration for timezone handling.*?except Exception as e:\s*print\(f"\[startup\] Database schema creation failed: \{e\}"\)', re.DOTALL)

new_block = """from sqlalchemy import inspect
            inspector = inspect(engine)
            sessions_cols = [c['name'] for c in inspector.get_columns('sessions')] if inspector.has_table('sessions') else []
            users_cols = [c['name'] for c in inspector.get_columns('users')] if inspector.has_table('users') else []

            with engine.connect() as conn:
                if 'scheduled_start' not in sessions_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start TIMESTAMP WITH TIME ZONE;"))
                            conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end TIMESTAMP WITH TIME ZONE;"))
                        print("[startup] Added scheduled_start and scheduled_end (TIMESTAMP WITH TIME ZONE).")
                    except Exception as e:
                        print(f"[startup] Failed to add scheduled_start/end (TIMESTAMP WITH TIME ZONE): {e}")
                        try:
                            with conn.begin():
                                conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start DATETIME;"))
                                conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end DATETIME;"))
                            print("[startup] Added scheduled_start and scheduled_end (DATETIME).")
                        except Exception as e2:
                            print(f"[startup] Failed to add scheduled_start/end (DATETIME): {e2}")
                else:
                    print("[startup] scheduled_start/end columns already exist.")

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
                    print("[startup] Migration error on data conversion:", e)

            with engine.connect() as conn:
                if 'dob' not in users_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE users ADD COLUMN dob VARCHAR;"))
                        print("[startup] Added dob column.")
                    except Exception as e:
                        print(f"[startup] Failed to add dob column: {e}")
                else:
                    print("[startup] dob column already exists.")

                if 'gender' not in users_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR;"))
                        print("[startup] Added gender column.")
                    except Exception as e:
                        print(f"[startup] Failed to add gender column: {e}")
                else:
                    print("[startup] gender column already exists.")
        except Exception as e:
            print(f"[startup] Database schema creation failed: {e}")"""

text = old_block_pattern.sub(new_block, text)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(text)
