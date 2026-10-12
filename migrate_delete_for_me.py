import os
import sys
from sqlalchemy import create_engine, inspect, text
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.app.database import DATABASE_URL
from backend.app.models import Base

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

def upgrade():
    with engine.begin() as conn:
        if not inspector.has_table("message_user_states"):
            print("Creating message_user_states table...")
            # We can use SQLAlchemy Base.metadata.create_all for the specific table
            from backend.app.models import MessageUserState
            MessageUserState.__table__.create(engine)
            print("Table created.")
        else:
            print("message_user_states table already exists.")

if __name__ == "__main__":
    upgrade()
    print("Migration complete.")
