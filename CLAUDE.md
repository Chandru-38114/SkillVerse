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
4. Discover ranked peers (tutor score = strength + measured learner gains + Bayesian rating)
   and tutors recommended for your weak topics; send connection requests.
5. A tutor accepts; both chat in real time and agree what to learn.
6. They schedule a session and meet in the **Learning Arena**: video, shared whiteboard,
   code compiler, notes, materials.
7. AI summarises the session into revision notes.
8. The learner takes a short reassessment; it nudges their course score 30% towards the result (badges stay Arena-only).
   A course is finished after 5 sessions + a passed final Skill Arena (60%+) → certificate.

## Repos and branches
- Main repo: `Chandru-38114/SkillVerse`. **All work happens on `main`.**
  `phase2-websocket-chat` was merged into `main` on 2026-10-13 and is now behind it —
  do not develop on it or use it as a reference.
- One-off maintenance scripts live in `scripts/` (run from the repo root, e.g.
  `python scripts/run_migrations.py`). Do not add throwaway fix/patch/test scripts
  to the repo root.
- `Chandru-38114/AI-Api-Application` — a separate Next.js prototype that first held the
  Gemini question-generation logic. Its generation logic has already been ported into this
  backend. Treat it as reference only; do not import from it.

## Tech stack
- Frontend: React 19, Vite, Tailwind CSS, React Router, framer-motion, lucide-react.
  Deployed on **Vercel**.
- Backend: Python, FastAPI, SQLAlchemy, Uvicorn. Deployed on **Render**.
- Database: PostgreSQL on Supabase (local dev falls back to SQLite). Supabase Storage holds
  chat files, voice notes, avatars and session materials.
- Real-time: WebSockets for chat / whiteboard / compiler sync; WebRTC for video.
- Auth: JWT (HS256) + bcrypt + Google OAuth.
- AI: Google Gemini via the `google-genai` package. (The old `google-generativeai`
  package is legacy — do not add new code that uses it.)

## Layout
backend/app/
  main.py                      app setup, CORS, error handler, routers
  db_migrations.py             startup checks: create tables, add new columns (NEW_COLUMNS list)
  models.py  schemas.py        SQLAlchemy models / Pydantic schemas (every *Out inherits UTCOut)
  auth.py                      passwords, JWT, get_current_user, get_user_from_token (WebSockets)
  database.py  supabase_client.py (upload_file / delete_file / signed_url / public_url)
  ws_manager.py                chat rooms + SessionRoomManager (video, code editor, whiteboard)
  routers/                     one file per feature: assessments, auth, users, marketplace,
                               requests, chat, sessions, compiler, whiteboard, materials,
                               progress, reviews, certificates, notifications, gamification,
                               exchanges, demand, community, badges, report_card, teacher_stats
  services/question_generator.py   AI question generation (see below)
  services/summarization.py        AI session summaries
  services/course_rules.py         who may teach/learn which course (see "Course rules")
  services/session_access.py       get_session_for_participant(): 404/403 check for session routes
  utils/timezone.py                utc_now(), as_utc() (naive = UTC), IST
  sandbox.py                   restricted Python execution for the compiler
  data/questions.py            hand-written fallback question bank
frontend/src/
  api.js                       ALL backend calls live here (sendFile() for uploads)
  pages/                       assessment (Skill Arena), messages, marketplace,
                               session_room (Learning Arena), dashboard, progress, ...
  components/                  Compiler, Whiteboard, VideoChat, Notes, Materials, ...
                               (DateTimePicker.jsx is unused — reference for the planned picker)

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
- If AI is unavailable: Python, Java, DSA and Web Development fall back to the static bank
  (response says `"source": "bank"`), other courses return 503.
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
- Backend: `python -m pytest backend/tests -q` (80 tests) and `python -m py_compile` on changed files.
- Frontend: `npm run build` must succeed.
- Reuse the shared helpers above instead of copying code (storage, session checks,
  time zones, WebSocket rooms, uploads in api.js).
- Only commit the files relevant to the task; leave unrelated files untouched.

## Course rules (round 3 — all in `backend/app/services/course_rules.py`)
- **One role per course.** A user teaches OR learns a course, never both. A teacher can't
  request, learn or "add as learning" a course they teach.
- **Removing a course** (⋯ menu on the Progress page): learning AND teaching courses can be
  removed to free a slot, unless the course still has an open request/connection or an
  upcoming session (`course_in_use_problem`).
- **Learner → teacher:** Skill Arena with the "teach" goal and **60%+** (not on a terminated
  attempt). The server decides the role on submit; the client's `role` is only the goal.
- **Max 4 courses** per user (teaching + learning). Any course name is allowed (the AI writes
  the questions); names are cleaned by `clean_course_name` (letters, digits, `+ # . / & -`).
- **Requests:** sender = learner, receiver = tutor. The receiver must teach the course and be
  2+ levels above (`teaching_problem`). "Teach in return" must be a course the sender teaches.
- **Progress:** 16% per completed session, capped at 80% after 5 sessions. 100% only after the
  learner then passes the **final Skill Arena with 60%+** (`user_skills.course_completed_at`).
  A badge alone is not 100% any more.
- **Certificate:** learners only, only at 100% (sessions + final), one per course.
- **Sessions:** 15 min – 3 h, up to 60 days ahead. The room opens 15 min before the start
  (socket closes 4425 earlier). A session counts only when tutor AND learner were both in the
  room (`sessions.both_joined_at`); otherwise it ends as Missed. Only such sessions can be
  completed, never before their start. Times can't be changed after someone joined; a session
  both joined can't be cancelled. The post-session reassessment is for the learner only (`services/topic_scores.py`).
- Old data with two rows for one course: `python scripts/fix_course_roles.py` (dry run), then
  `--apply`. Tests: `backend/tests/test_course_rules.py`.

## Known gaps / roadmap
- Built (final round): topic scores (`topic_scores` table), post-session reassessment,
  teaching impact, knowledge-gap recommendations (`GET /marketplace/recommended`) and tutor
  ranking — maths in `services/tutor_ranking.py`, tests in `test_reassessment.py` / `test_tutor_ranking.py`.
- Coding questions ARE auto-graded (`services/code_grader.py`); fallback question banks exist
  for Python, Java, DSA and Web Development.
- Forgot-password needs real email delivery on production (`email_service.py` only logs).
- Team-trained models (Qwen2.5-3B, BGE-M3) will replace the Gemini API later.
- A UI/UX redesign is planned; the current UI is functional but plain.
