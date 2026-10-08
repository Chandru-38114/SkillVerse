# SkillVerse — project guide for AI assistants

## What this is
SkillVerse is a peer-to-peer learning platform. Every user is BOTH a teacher and a
learner: you teach what you know and learn what you don't, often with the same partner.
The platform verifies skills with an AI assessment before a user is shown as a tutor.

Supported courses: Python, Java, Data Structures and Algorithms (DSA), Web Development.
Audience: students, plus IT professionals changing career tracks.

Student team project (final year). Keep solutions simple and readable over clever.

## The user journey (the whole product in 8 steps)
1. Sign up, declare skills to learn and skills to teach.
2. Take a proctored assessment in the **Skill Arena** (fullscreen, tab-switch detection,
   3 violations = auto-submit).
3. The AI scores it: overall score, level, per-topic mastery, weak topics, badge.
4. Discover ranked peers; send connection requests to several at once.
5. A tutor accepts; both chat in real time and agree what to learn.
6. They schedule a session and meet in the **Learning Arena**: video, shared whiteboard,
   code compiler, notes, materials.
7. AI summarises the session into revision notes.
8. Both reassess; skill profiles update. (Post-session reassessment is still planned.)

## Repos and branches
- Main repo: `Chandru-38114/SkillVerse`. **All work happens on branch `phase2-websocket-chat`.**
  `main` is an old September skeleton — do not use it as a reference.
- `Chandru-38114/AI-Api-Application` — a separate Next.js prototype that first held the
  Gemini question-generation logic. Its generation logic has already been ported into this
  backend. Treat it as reference only; do not import from it.

## Tech stack
- Frontend: React 19, Vite, Tailwind CSS, React Router, framer-motion, lucide-react.
  Deployed on **Vercel**.
- Backend: Python, FastAPI, SQLAlchemy, Uvicorn. Deployed on **Render**.
- Database: PostgreSQL on Supabase (local dev falls back to SQLite). Supabase Storage holds
  chat files, voice notes and avatars.
- Real-time: WebSockets for chat / whiteboard / compiler sync; WebRTC for video.
- Auth: JWT (HS256) + bcrypt + Google OAuth.
- AI: Google Gemini via the `google-genai` package. (The old `google-generativeai`
  package is legacy — do not add new code that uses it.)

## Layout
backend/app/
  main.py                      app setup, CORS, startup table creation
  models.py  schemas.py        SQLAlchemy models / Pydantic schemas
  auth.py  database.py
  routers/                     assessments, auth, users, marketplace, requests, chat,
                               sessions, compiler, whiteboard, materials, progress,
                               reviews, certificates, notifications, gamification
  services/question_generator.py   AI question generation (see below)
  services/summarization.py        AI session summaries
  sandbox.py                   restricted Python execution for the compiler
  data/questions.py            legacy hand-written question bank (fallback only)
frontend/src/
  api.js                       ALL backend calls live here
  pages/                       assessment (Skill Arena), messages, marketplace,
                               session_room (Learning Arena), dashboard, progress, ...
  components/                  Compiler, Whiteboard, VideoChat, Notes, Materials, ...

## How the AI assessment works (important)
- `POST /assessments/start` asks Gemini for a fresh assessment, stores the questions
  **with their answers** server-side in the `assessment_sessions` table, and returns
  `attempt_id` plus questions **without** answers.
- `POST /assessments/submit` sends `attempt_id`; scoring uses the SERVER's stored copy.
  It checks ownership and rejects a second submission with 409.
- **Rule: answer keys must never be sent to the browser.** Never return `answer` or
  `explanation` from any endpoint the client calls.
- Generated mix: 6 MCQs, 3 code-tracing ("output") questions, 1 debugging question.
  Each is tagged with a topic from `SKILL_TOPICS`, which drives weak-topic analysis.
- Invalid AI output (duplicate options, bad answer index) is dropped; options are shuffled;
  if one model fails, the next in `GEMINI_MODELS` is tried.
- If AI is unavailable: Python and JavaScript fall back to the static bank
  (response says `"source": "bank"`), other skills return 503.
- The AI layer is deliberately isolated in `services/question_generator.py` because the
  team is training its own models (Qwen2.5-3B for written answers, BGE-M3 embeddings)
  to replace the Gemini API calls later. Keep that file the only place AI is called from.

## The code compiler
- `POST /compiler/arena/run` — Skill Arena, any signed-in user.
- `POST /compiler/{session_id}/run` — Learning Arena, participants only.
- Both call `execute_python()` in `routers/compiler.py`, which runs `sandbox.py` in a
  subprocess with an EMPTY environment (no server secrets), isolated mode, 256 MB memory,
  3 s CPU, 4 s wall timeout, and output capped at 20,000 characters.
- `sandbox.py` blocks dangerous imports, dunder access (including via `getattr` and format
  strings), file/process/socket operations, and `eval`/`exec`/`open`.
- **Only Python executes.** Java and JavaScript can be written but not run.
- If you touch the sandbox, re-test both normal student code (classes, comprehensions,
  recursion) and escape attempts such as `getattr((), "__class__")`.

## Environment variables (Render)
`DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, Supabase keys, Google OAuth client id,
`GEMINI_API_KEY`, and optionally `GEMINI_MODELS` (comma-separated, default
`gemini-3.6-flash,gemini-3.5-flash-lite`).
Frontend uses `VITE_API_URL`. Never hardcode or print secrets.

## Conventions
- Put every backend call in `frontend/src/api.js`; pages call `api.something()`.
- WebSocket endpoints: ACCEPT the connection first, then authenticate, then close with a
  specific code (4401 / 4403) on failure. Closing before accepting makes the browser see a
  generic 1006 and reconnect forever. Wrap handlers so errors always clean up.
- Every WebSocket passes the JWT as a `?token=` query parameter (browsers cannot set
  headers on a handshake).
- Never trust client-supplied scores, skill names or answer keys; re-read from the DB.
- New tables are created at startup by `Base.metadata.create_all`; avoid destructive
  migrations against production.
- Commit style: `type(scope): short description`, e.g. `fix(chat): ...`, `feat(skill-arena): ...`.

## Checks before committing
- Backend: `python -m py_compile` on every changed file.
- Frontend: `npm run build` must succeed.
- Only commit the files relevant to the task; leave unrelated files untouched.

## Known gaps / roadmap
- Post-session reassessment, tutor ranking, knowledge-gap recommendations: not built yet.
- Coding questions are not auto-graded.
- Team-trained models (Qwen2.5-3B, BGE-M3) will replace the Gemini API later.
- A UI/UX redesign is planned; the current UI is functional but plain.
