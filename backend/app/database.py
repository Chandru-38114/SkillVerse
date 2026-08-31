import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Read the database URL from the environment.
# Set DATABASE_URL to a PostgreSQL connection string for production, e.g.:
#   DATABASE_URL=postgresql://user:password@host:5432/skillverse
# When DATABASE_URL is not set, the app falls back to SQLite so local
# development works without any configuration.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./skillverse.db")

# check_same_thread is a SQLite-only argument.
# Passing it to the psycopg2 PostgreSQL driver raises a TypeError at startup,
# so we only include it when the active database is SQLite.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()