from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, users, assessments, marketplace, requests, chat

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SkillVerse AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                  "https://whimsical-raindrop-f3df51.netlify.app"
    ],  # Vite dev server
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


@app.get("/")
def root():
    return {"status": "ok", "service": "SkillVerse AI API"}
