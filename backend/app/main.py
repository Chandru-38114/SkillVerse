import logging
import os
import sys
from sqlalchemy import text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import asyncio
from contextlib import asynccontextmanager

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)

from .database import Base, engine
from .routers import (
    auth, users, assessments, marketplace, requests, chat, reviews,
    sessions, compiler, whiteboard, materials, progress, certificates,
    notifications, gamification, exchanges, report_card, teacher_stats,
    demand, community,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_db():
        import time
        t_startup_start = time.perf_counter()
        try:
            Base.metadata.create_all(engine)
            
            from sqlalchemy import inspect
            inspector = inspect(engine)
            
            # Read columns once per table
            sessions_cols = set(c['name'] for c in inspector.get_columns('sessions')) if inspector.has_table('sessions') else set()
            users_cols = set(c['name'] for c in inspector.get_columns('users')) if inspector.has_table('users') else set()
            reviews_cols = set(c['name'] for c in inspector.get_columns('reviews')) if inspector.has_table('reviews') else set()
            session_progress_cols = set(c['name'] for c in inspector.get_columns('session_progress')) if inspector.has_table('session_progress') else set()
            assessment_sessions_cols = set(c['name'] for c in inspector.get_columns('assessment_sessions')) if inspector.has_table('assessment_sessions') else set()
            user_skills_cols = set(c['name'] for c in inspector.get_columns('user_skills')) if inspector.has_table('user_skills') else set()
            conn_reqs_cols = set(c['name'] for c in inspector.get_columns('connection_requests')) if inspector.has_table('connection_requests') else set()

            all_columns_present = (
                {'scheduled_start', 'scheduled_end'}.issubset(sessions_cols) and
                {'dob', 'gender'}.issubset(users_cols) and
                {'session_id'}.issubset(reviews_cols) and
                {'semantic_summary', 'next_session_plan'}.issubset(session_progress_cols) and
                {'expires_at', 'violations', 'terminated', 'session_id'}.issubset(assessment_sessions_cols) and
                {'level_num'}.issubset(user_skills_cols) and
                {'points_awarded'}.issubset(conn_reqs_cols) and
                inspector.has_table('exchange_groups') and
                inspector.has_table('exchange_legs') and
                inspector.has_table('exchange_members') and
                inspector.has_table('weekly_attempts') and
                inspector.has_table('demand_requests') and
                inspector.has_table('lounge_posts') and
                inspector.has_table('lounge_comments') and
                inspector.has_table('study_circles') and
                inspector.has_table('study_circle_participants') and
                inspector.has_table('senior_questions') and
                inspector.has_table('senior_answers') and
                inspector.has_table('weekly_challenges') and
                inspector.has_table('weekly_challenge_responses') and
                inspector.has_table('hackathons') and
                inspector.has_table('hackathon_participants')
            )

            def _backfill_level_num():
                try:
                    from .utils.levels import score_to_level
                    with engine.connect() as conn:
                        unfilled = conn.execute(text(
                            "SELECT id, latest_score FROM user_skills WHERE (level_num = 0 OR level_num IS NULL) AND latest_score IS NOT NULL"
                        )).fetchall()
                        if unfilled:
                            with conn.begin():
                                for r_id, r_score in unfilled:
                                    new_lvl = score_to_level(r_score)
                                    conn.execute(
                                        text("UPDATE user_skills SET level_num = :lvl WHERE id = :id"),
                                        {"lvl": new_lvl, "id": r_id}
                                    )
                            print(f"[startup] Backfilled level_num from latest_score for {len(unfilled)} user_skills rows.")
                except Exception as e:
                    print(f"[startup] level_num backfill skipped/failed: {e}")

            if all_columns_present:
                _backfill_level_num()
                elapsed_ms = (time.perf_counter() - t_startup_start) * 1000.0
                print(f"[startup] Database schema verified and up-to-date in {elapsed_ms:.1f}ms; skipped migrations.")
                return

            with engine.connect() as conn:
                if 'scheduled_start' not in sessions_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start TIMESTAMP WITH TIME ZONE;"))
                            conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end TIMESTAMP WITH TIME ZONE;"))
                        print("[startup] Added scheduled_start and scheduled_end (TIMESTAMP WITH TIME ZONE).")
                    except Exception as e:
                        try:
                            with conn.begin():
                                conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_start DATETIME;"))
                                conn.execute(text("ALTER TABLE sessions ADD COLUMN scheduled_end DATETIME;"))
                            print("[startup] Added scheduled_start and scheduled_end (DATETIME).")
                        except Exception as e2:
                            print(f"[startup] Failed to add scheduled_start/end: {e2}")

                try:
                    with conn.begin():
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
                    pass

                if 'dob' not in users_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE users ADD COLUMN dob VARCHAR;"))
                        print("[startup] Added dob column.")
                    except Exception as e:
                        print(f"[startup] Failed to add dob column: {e}")

                if 'gender' not in users_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR;"))
                        print("[startup] Added gender column.")
                    except Exception as e:
                        print(f"[startup] Failed to add gender column: {e}")

                if 'session_id' not in reviews_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE reviews ADD COLUMN session_id INTEGER REFERENCES sessions(id) NULL;"))
                        print("[startup] Added session_id column to reviews.")
                    except Exception as e:
                        print(f"[startup] Failed to add session_id column: {e}")

                if 'semantic_summary' not in session_progress_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE session_progress ADD COLUMN semantic_summary TEXT NULL;"))
                        print("[startup] Added semantic_summary column to session_progress.")
                    except Exception as e:
                        print(f"[startup] Failed to add semantic_summary column: {e}")

                if 'next_session_plan' not in session_progress_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE session_progress ADD COLUMN next_session_plan TEXT;"))
                        print("[startup] Added next_session_plan column to session_progress.")
                    except Exception as e:
                        print(f"[startup] Failed to add next_session_plan column: {e}")

                if 'expires_at' not in assessment_sessions_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE assessment_sessions ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;"))
                        print("[startup] Added expires_at column (TIMESTAMP WITH TIME ZONE) to assessment_sessions.")
                    except Exception as e:
                        try:
                            with conn.begin():
                                conn.execute(text("ALTER TABLE assessment_sessions ADD COLUMN expires_at DATETIME;"))
                            print("[startup] Added expires_at column (DATETIME) to assessment_sessions.")
                        except Exception as e2:
                            print(f"[startup] Failed to add expires_at: {e2}")

                if 'violations' not in assessment_sessions_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE assessment_sessions ADD COLUMN violations INTEGER NOT NULL DEFAULT 0;"))
                        print("[startup] Added violations column to assessment_sessions.")
                    except Exception as e:
                        print(f"[startup] Failed to add violations column: {e}")

                if 'terminated' not in assessment_sessions_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE assessment_sessions ADD COLUMN terminated BOOLEAN NOT NULL DEFAULT FALSE;"))
                        print("[startup] Added terminated column to assessment_sessions.")
                    except Exception as e:
                        print(f"[startup] Failed to add terminated column: {e}")

                if 'session_id' not in assessment_sessions_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE assessment_sessions ADD COLUMN session_id INTEGER REFERENCES sessions(id) NULL;"))
                        print("[startup] Added session_id column (with FK) to assessment_sessions.")
                    except Exception as e:
                        try:
                            with conn.begin():
                                conn.execute(text("ALTER TABLE assessment_sessions ADD COLUMN session_id INTEGER;"))
                            print("[startup] Added session_id column (no FK) to assessment_sessions.")
                        except Exception as e2:
                            print(f"[startup] Failed to add session_id: {e2}")

                if 'level_num' not in user_skills_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE user_skills ADD COLUMN level_num INTEGER NOT NULL DEFAULT 0;"))
                        print("[startup] Added level_num column to user_skills.")
                    except Exception as e:
                        print(f"[startup] Failed to add level_num column: {e}")

                if 'points_awarded' not in conn_reqs_cols:
                    try:
                        with conn.begin():
                            conn.execute(text("ALTER TABLE connection_requests ADD COLUMN points_awarded BOOLEAN NOT NULL DEFAULT FALSE;"))
                        print("[startup] Added points_awarded column to connection_requests.")
                    except Exception as e:
                        print(f"[startup] Failed to add points_awarded column: {e}")

                if not inspector.has_table('weekly_attempts'):
                    try:
                        with conn.begin():
                            models.WeeklyAttempt.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created weekly_attempts table.")
                    except Exception as e:
                        print(f"[startup] Failed to create weekly_attempts table: {e}")

                if not inspector.has_table('demand_requests'):
                    try:
                        with conn.begin():
                            models.DemandRequest.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created demand_requests table.")
                    except Exception as e:
                        print(f"[startup] Failed to create demand_requests table: {e}")

                if not inspector.has_table('lounge_posts'):
                    try:
                        with conn.begin():
                            models.LoungePost.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created lounge_posts table.")
                    except Exception as e:
                        print(f"[startup] Failed to create lounge_posts table: {e}")

                if not inspector.has_table('lounge_comments'):
                    try:
                        with conn.begin():
                            models.LoungeComment.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created lounge_comments table.")
                    except Exception as e:
                        print(f"[startup] Failed to create lounge_comments table: {e}")

                if not inspector.has_table('study_circles'):
                    try:
                        with conn.begin():
                            models.StudyCircle.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created study_circles table.")
                    except Exception as e:
                        print(f"[startup] Failed to create study_circles table: {e}")

                if not inspector.has_table('study_circle_participants'):
                    try:
                        with conn.begin():
                            models.StudyCircleParticipant.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created study_circle_participants table.")
                    except Exception as e:
                        print(f"[startup] Failed to create study_circle_participants table: {e}")

                if not inspector.has_table('senior_questions'):
                    try:
                        with conn.begin():
                            models.SeniorQuestion.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created senior_questions table.")
                    except Exception as e:
                        print(f"[startup] Failed to create senior_questions table: {e}")

                if not inspector.has_table('senior_answers'):
                    try:
                        with conn.begin():
                            models.SeniorAnswer.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created senior_answers table.")
                    except Exception as e:
                        print(f"[startup] Failed to create senior_answers table: {e}")

                if not inspector.has_table('weekly_challenges'):
                    try:
                        with conn.begin():
                            models.WeeklyChallenge.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created weekly_challenges table.")
                    except Exception as e:
                        print(f"[startup] Failed to create weekly_challenges table: {e}")

                if not inspector.has_table('weekly_challenge_responses'):
                    try:
                        with conn.begin():
                            models.WeeklyChallengeResponse.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created weekly_challenge_responses table.")
                    except Exception as e:
                        print(f"[startup] Failed to create weekly_challenge_responses table: {e}")

                if not inspector.has_table('hackathons'):
                    try:
                        with conn.begin():
                            models.Hackathon.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created hackathons table.")
                    except Exception as e:
                        print(f"[startup] Failed to create hackathons table: {e}")

                if not inspector.has_table('hackathon_participants'):
                    try:
                        with conn.begin():
                            models.HackathonParticipant.__table__.create(bind=conn, checkfirst=True)
                        print("[startup] Created hackathon_participants table.")
                    except Exception as e:
                        print(f"[startup] Failed to create hackathon_participants table: {e}")

            _backfill_level_num()

            elapsed_ms = (time.perf_counter() - t_startup_start) * 1000.0
            print(f"[startup] Database startup checks completed in {elapsed_ms:.1f}ms.")
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
    allow_origins=origins + [
        "https://whimsical-raindrop-f3df51.netlify.app"
    ],
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
app.include_router(exchanges.router)
app.include_router(report_card.router)
app.include_router(teacher_stats.router)
app.include_router(demand.router)
app.include_router(community.router)



@app.get("/")
def root():
    return {"status": "ok", "service": "SkillVerse AI API"}
