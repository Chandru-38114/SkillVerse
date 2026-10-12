import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    try:
        with open("backend/.env") as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    DATABASE_URL = line.strip().split("=", 1)[1]
    except:
        pass
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///backend/skillverse.db"

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("--- EXISTING SESSIONS ---")
    try:
        result = conn.execute(text("SELECT id, session_date, start_time, end_time, status FROM sessions LIMIT 10;"))
        for row in result:
            print(row)
    except Exception as e:
        print("Error reading sessions:", e)
