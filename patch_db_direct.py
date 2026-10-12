content = """import os
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker, declarative_base

# Read the database URL from the environment.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./skillverse.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# Safe Supabase production configuration for Session Mode
# Using NullPool because Supabase PgBouncer (Session Mode) has a strict limit of 15 connections.
# NullPool prevents SQLAlchemy from holding idle connections in memory.
# It opens and closes the physical connection immediately, safely multiplexing on PgBouncer.
engine = create_engine(
    DATABASE_URL, 
    connect_args=_connect_args,
    poolclass=NullPool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
"""
with open('backend/app/database.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("database.py perfectly overwritten")
