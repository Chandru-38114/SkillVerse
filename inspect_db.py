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

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    print("--- SESSIONS TABLE ---")
    result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sessions';"))
    for row in result:
        print(row)
