# SkillVerse

A peer-to-peer learning platform where every student is both a **teacher** and a **learner**.
An AI-proctored **Skill Arena** verifies what you know; you then teach that to peers and
learn what you don't, in a live **Learning Arena** with video, a shared whiteboard and a code editor.

- Live site: https://skill-verse-theta.vercel.app
- API: https://skillverse-api-fm56.onrender.com (free plan: sleeps after 15 min idle, first request takes ~50 s)
- Final-year team project, B.Tech Department of Intelligence Systems and Cybersecurity.

## The journey

1. **Sign up** (email or Google) and add up to 4 courses to learn or teach.
2. **Skill Arena**: an AI-generated, proctored test (fullscreen, tab-switch detection, 3 strikes = auto-submit).
   You get a score, level, badge, a per-topic radar and a study plan. 60%+ with the "teach" goal makes you a tutor.
3. **Discover**: tutors ranked by match, strength, measured learner gains and rating, plus
   **"Recommended for your weak topics"** (tutors strong where you're weak).
4. **Request and chat** in real time (files, voice notes, read receipts), then **schedule** a session.
5. **Learning Arena**: video call, whiteboard, shared Python editor, notes and materials.
6. **AI session summary** and a short **reassessment** that nudges your course score and records topic scores.
7. **Progress**: 16% per completed session (max 80%); pass the final Skill Arena with 60%+ for 100% and a certificate.
8. **Teaching stats**: a "Teaching DNA" radar and measured learner gains for tutors.

## Tech stack

| Part | Technology | Hosting |
|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, framer-motion | Vercel |
| Backend | Python, FastAPI, SQLAlchemy, Uvicorn | Render |
| Database / files | PostgreSQL + Storage on Supabase (SQLite locally) | Supabase |
| Real-time | WebSockets (chat, whiteboard, editor), WebRTC video (Metered TURN) | |
| Auth | JWT (PyJWT, HS256), bcrypt, Google OAuth | |
| AI | Google Gemini (`google-genai`), OpenRouter as backup, hand-written question banks as fallback | |

## Folder layout

```
backend/app/        FastAPI app: main.py, models.py, schemas.py, auth.py, db_migrations.py
  routers/          one file per feature (auth, assessments, marketplace, chat, sessions, progress, ...)
  services/         question_generator (all AI calls), course_rules, topic_scores, tutor_ranking, ...
  data/questions.py fallback question banks
  sandbox.py        restricted Python runner for the code editor
backend/tests/      unit tests (pytest)
frontend/src/       api.js (every backend call), pages/, components/, utils/
eval/               evaluation scripts for the report (see eval/README.md)
scripts/            one-off maintenance scripts (run from the repo root)
CLAUDE.md           detailed rules and conventions for AI coding assistants
```

## Run it locally

Backend (from the repo root):

```bash
python -m venv venv && source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env                   # fill in what you need; all optional locally
uvicorn backend.app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env                                   # VITE_API_URL=http://localhost:8000
npm run dev                                            # http://localhost:5173
```

Without any keys it still works locally: SQLite database, question banks instead of AI,
email codes shown on screen (`DEV_OTP_MODE`), and file uploads disabled until Supabase keys are set.

## Settings (environment variables)

Names only — **never commit real values**. The full list with explanations is in
`backend/.env.example` and `frontend/.env.example`.

- Render (backend): `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GOOGLE_CLIENT_ID`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `METERED_DOMAIN`, `METERED_API_KEY`, `DEV_OTP_MODE`
- Vercel (frontend): `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`

## Deploying

Push to `main`. Vercel rebuilds the frontend and Render redeploys the backend automatically.
On start-up the backend creates new tables and adds missing columns by itself (`db_migrations.py`),
so no manual migration is needed. Keep the API warm with a free uptime monitor (UptimeRobot or
cron-job.org) hitting `https://skillverse-api-fm56.onrender.com/` every 5 minutes.

## Checks before every commit

```bash
python -m pytest backend/tests -q        # 80 tests
cd frontend && npm run build
```

## Security notes

- Answer keys never leave the server; scores are always computed from the server's copy.
- Every API route needs a login except sign-up/login/password reset, certificate verification,
  the leaderboard and public profile reviews/badges. WebSockets check the token and that you're in the session.
- Uploads: avatars must be real PNG/JPEG/GIF/WebP; chat files that could run scripts are stored as downloads.
- Login lockout after repeated failures; password reset needs the emailed code; Skill Arena limited to 10 new attempts a day.
- The code editor runs Python in a sandbox (no files, network or imports of dangerous modules; 3 s CPU, 256 MB).
- Known: Tailwind 3's build tools have dependency advisories (build machine only, not shipped);
  fixing them needs a Tailwind 4 upgrade.

## Still to do

- Real email delivery for password reset (codes are only logged on production today).
- Replace the Gemini calls with the team's own models (Qwen2.5-3B, BGE-M3) — all AI calls are in
  `backend/app/services/question_generator.py` to make that swap easy.
- Optional ideas: flashcards from session summaries, multilingual summaries, free-slot finder.
