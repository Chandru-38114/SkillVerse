import os
import sys
from sqlalchemy import create_engine, inspect, text
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.app.database import DATABASE_URL

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

def upgrade():
    is_sqlite = DATABASE_URL.startswith("sqlite")

    with engine.begin() as conn:
        cols = [c['name'] for c in inspector.get_columns('messages')]

        if 'metadata' not in cols:
            print("Adding metadata column...")
            if is_sqlite:
                conn.execute(text("ALTER TABLE messages ADD COLUMN metadata JSON DEFAULT '{}' NOT NULL"))
            else:
                conn.execute(text("ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb NOT NULL"))
        else:
            print("metadata column already exists.")

        indexes = [idx['name'] for idx in inspector.get_indexes('messages')]
        if 'ix_messages_request_id_created_at' not in indexes:
            print("Adding index ix_messages_request_id_created_at...")
            conn.execute(text("CREATE INDEX ix_messages_request_id_created_at ON messages (request_id, created_at)"))
        else:
            print("Index already exists.")

if __name__ == "__main__":
    upgrade()
    print("Migration complete.")
