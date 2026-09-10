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

# Read allowed origins from the environment.
# Set FRONTEND_URL to your deployed frontend URL in production.
# Multiple origins can be separated by commas:
# export FRONTEND_URL="https://skillverse.com,https://www.skillverse.com"
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
origins = [origin.strip() for origin in frontend_url.split(",")]

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