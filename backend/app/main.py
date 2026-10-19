"""
SkillVerse API — FastAPI app setup.

- Startup: database checks run in the background (db_migrations.py) so the
  server can start answering immediately.
- CORS: which websites may call this API (see the CORS section below).
- A catch-all error handler that never leaks error details to the browser.
- All routers (one file per feature in routers/).
"""
import asyncio
import logging
import os
import re
import sys
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)

from .db_migrations import run_startup_migrations  # noqa: E402
from .routers import (  # noqa: E402
    auth, users, assessments, marketplace, requests, chat, reviews,
    sessions, compiler, whiteboard, materials, progress, certificates,
    notifications, gamification, exchanges, report_card, teacher_stats,
    demand, community, badges, practice,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run the database checks in a background thread without awaiting them,
    # so Uvicorn binds the port instantly (Render waits for the port).
    asyncio.get_event_loop().run_in_executor(None, run_startup_migrations)
    yield


app = FastAPI(title="SkillVerse AI API", version="0.1.0", lifespan=lifespan)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ---------------------------------------------------------------------------
# CORS — which frontends may call the API
#   FRONTEND_URL        comma-separated production frontends (set on Render),
#                       e.g. https://skill-verse-theta.vercel.app
#   ADDITIONAL_ORIGINS  extra origins, appended to FRONTEND_URL
# Always allowed: localhost:5173 (local dev), the old Netlify site and this
# project's Vercel deployments (skill-verse*.vercel.app).
# ---------------------------------------------------------------------------
_LOCAL_DEV_ORIGIN = "http://localhost:5173"
_OLD_NETLIFY_ORIGIN = "https://whimsical-raindrop-f3df51.netlify.app"
# Production + preview deployments of THIS Vercel project only (not every *.vercel.app site).
_VERCEL_ORIGIN_REGEX = r"https://skill-verse[a-z0-9-]*\.vercel\.app"


def _configured_origins() -> list:
    """localhost + FRONTEND_URL + ADDITIONAL_ORIGINS, without duplicates."""
    raw = ",".join(filter(None, [os.environ.get("FRONTEND_URL", ""), os.environ.get("ADDITIONAL_ORIGINS", "")]))
    parsed = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return list(dict.fromkeys([_LOCAL_DEV_ORIGIN] + parsed))  # dict keeps the order


origins = _configured_origins()
print(f"[CORS] Allowed origins ({len(origins)}): {origins}")


def _is_allowed_origin(origin: str) -> bool:
    return (
        origin in origins
        or origin == _OLD_NETLIFY_ORIGIN
        or re.fullmatch(_VERCEL_ORIGIN_REGEX, origin) is not None
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled Exception: {exc}")
    traceback.print_exc()

    # FastAPI's default 500 response has no CORS headers, so the browser would
    # hide the error. Add them — but only for origins we actually allow.
    origin = request.headers.get("origin")
    headers = {}
    if origin and _is_allowed_origin(origin):
        headers["access-control-allow-origin"] = origin
        headers["access-control-allow-credentials"] = "true"
        headers["vary"] = "Origin"

    # Never send exception text to the browser: it can contain SQL, table
    # names and user data. Full details are in the server log above.
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Please try again."},
        headers=headers,
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins + [_OLD_NETLIFY_ORIGIN],
    allow_origin_regex=_VERCEL_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Basic hardening headers on every API response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


for _router in (
    auth, users, assessments, marketplace, requests, chat, sessions, compiler,
    whiteboard, materials, progress, reviews, certificates, notifications,
    gamification, exchanges, report_card, teacher_stats, demand, community, badges, practice,
):
    app.include_router(_router.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "SkillVerse AI API"}
