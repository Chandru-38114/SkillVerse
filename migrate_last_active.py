import os
import sys
from sqlalchemy import create_engine, inspect, text
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.app.database import DATABASE_URL

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

def upgrade():
    with engine.begin() as conn:
        cols = [c["name"] for c in inspector.get_columns("users")]
        if "last_active" not in cols:
            print("Adding last_active column...")
            is_sqlite = DATABASE_URL.startswith("sqlite")
            if is_sqlite:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_active DATETIME NULL"))
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_active TIMESTAMP NULL"))
            print("last_active added.")
        else:
            print("last_active already exists.")

if __name__ == "__main__":
    upgrade()
