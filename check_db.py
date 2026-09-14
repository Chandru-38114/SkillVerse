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
    print("NO DATABASE_URL FOUND")
else:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Connected. Dialect:", engine.dialect.name)
        try:
            res = conn.execute(text("SELECT id, session_date, start_time, end_time FROM sessions LIMIT 1"))
            print("Session row:", res.fetchone())
        except Exception as e:
            print("Error:", e)
