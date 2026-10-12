# SkillVerse

An AI-powered learning platform that helps students assess their skills, generate personalized learning roadmaps, and track their progress.

## Tech Stack

Frontend
- React
- Vite
- Tailwind CSS

Backend
- FastAPI
- SQLAlchemy
- SQLite
- JWT Authentication

## Run Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Production Server Keep-Alive (Render Free Tier)

Render free instances spin down after 15 minutes of inactivity. To prevent slow cold starts for users, set up a free uptime monitor:
- Use [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org).
- Configure a standard `GET` HTTP check hitting `https://skillverse-api-fm56.onrender.com/` every 5 minutes.
- This ensures the server remains warm and responds immediately when students log in.