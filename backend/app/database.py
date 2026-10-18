"""
Database connection. DATABASE_URL picks Postgres (Supabase, production) or
the local SQLite file skillverse.db.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Read the database URL from the environment.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./skillverse.db")

_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

if _is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args=_connect_args,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args=_connect_args,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=300
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
