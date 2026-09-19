import os
from sqlalchemy import text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import asyncio
from contextlib import asynccontextmanager

from .database import Base, engine
from .routers import (
    auth, users, assessments, marketplace, requests, chat, reviews,
    sessions, compiler, whiteboard, materials, progress, certificates,
    notifications, gamification,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_db():
        try:
            Base.metadata.create_all(engine)
            print("[startup] Database schema ready.")
            
            
            from sqlalchemy import inspect
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
                    
            reviews_cols = [c['name'] for c in inspector.get_columns('reviews')] if inspector.has_table('reviews') else []
            with engine.connect() as conn:
                if 'session_id' not in reviews_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE reviews ADD COLUMN session_id INTEGER REFERENCES sessions(id) NULL;"))
                        print("[startup] Added session_id column to reviews.")
                    except Exception as e:
                        print(f"[startup] Failed to add session_id column: {e}")
                else:
                    print("[startup] session_id column already exists in reviews.")
        except Exception as e:
            print(f"[startup] Database schema creation failed: {e}")

    # Run DB schema creation in a background thread without awaiting it.
    # This allows the lifespan to yield immediately, letting Uvicorn bind 
    # the port instantly while the DB connection happens in the background.
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, init_db)
    
    yield
    # (shutdown: nothing to clean up)

app = FastAPI(title="SkillVerse AI API", version="0.1.0", lifespan=lifespan)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ---------------------------------------------------------------------------
# CORS — allowed origins
# Set FRONTEND_URL on Render to all production frontend origins, comma-separated.
# Example:
#   FRONTEND_URL=https://skill-verse-theta.vercel.app,https://whimsical-raindrop-f3df51.netlify.app
# ADDITIONAL_ORIGINS can be used to append extra origins without replacing FRONTEND_URL.
# localhost:5173 is always included for local development.
# ---------------------------------------------------------------------------
_ALWAYS_ALLOWED = ["http://localhost:5173"]

_raw_frontend = os.environ.get("FRONTEND_URL", "")
_raw_additional = os.environ.get("ADDITIONAL_ORIGINS", "")

_all_raw = ",".join(filter(None, [_raw_frontend, _raw_additional]))
_parsed = [o.strip().rstrip('/') for o in _all_raw.split(",") if o.strip()]

# Merge and deduplicate while preserving order
_seen: set = set()
origins: list = []
for _o in _ALWAYS_ALLOWED + _parsed:
    if _o not in _seen:
        _seen.add(_o)
        origins.append(_o)

print(f"[CORS] Allowed origins ({len(origins)}): {origins}")

from fastapi.responses import JSONResponse
from fastapi.requests import Request
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled Exception: {exc}")
    traceback.print_exc()
    
    # We must explicitly add CORS headers here because FastAPI's default 500 handler strips them
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["access-control-allow-origin"] = origin
        headers["access-control-allow-credentials"] = "true"
        
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers=headers
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assessments.router)
app.include_router(marketplace.router)
app.include_router(requests.router)
app.include_router(chat.router)
app.include_router(sessions.router)
app.include_router(compiler.router)
app.include_router(whiteboard.router)
app.include_router(materials.router)
app.include_router(progress.router)
app.include_router(reviews.router)
app.include_router(certificates.router)
app.include_router(notifications.router)
app.include_router(gamification.router)



@app.get("/")
def root():
    return {"status": "ok", "service": "SkillVerse AI API"}