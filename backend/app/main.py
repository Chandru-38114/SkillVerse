import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import auth, users, assessments, marketplace, requests, chat, reviews, sessions, compiler, whiteboard, materials, progress, certificates, notifications, gamification

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SkillVerse AI API", version="0.1.0")

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
_parsed = [o.strip() for o in _all_raw.split(",") if o.strip()]

# Merge and deduplicate while preserving order
_seen: set = set()
origins: list = []
for _o in _ALWAYS_ALLOWED + _parsed:
    if _o not in _seen:
        _seen.add(_o)
        origins.append(_o)

print(f"[CORS] Allowed origins ({len(origins)}): {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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