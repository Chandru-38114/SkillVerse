import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, users, assessments, marketplace, requests, chat, reviews, sessions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SkillVerse AI API", version="0.1.0")

# Read allowed origins from the environment.
# Set FRONTEND_URL to your deployed frontend URL in production.
# Multiple origins can be separated by commas:
#   FRONTEND_URL=https://skillverse.app,https://www.skillverse.app
# Falls back to the local Vite dev server when the variable is not set.
_raw_origins = os.environ.get("FRONTEND_URL", "http://localhost:5173")
allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
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
app.include_router(reviews.router)
app.include_router(sessions.router)



@app.get("/")
def root():
    return {"status": "ok", "service": "SkillVerse AI API"}