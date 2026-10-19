"""
Practice: LeetCode-style problems per course.

  GET  /practice/courses                    courses with problem counts and my solved counts
  GET  /practice/problems?course=&difficulty=&q=   the list, with my status (solved / attempted)
  GET  /practice/problems/{slug}            statement, examples, starter code (no hidden tests)
  POST /practice/problems/{slug}/run        run on the SAMPLE tests (answers shown)
  POST /practice/problems/{slug}/submit     run on ALL tests, save, points for a first solve
  GET  /practice/problems/{slug}/submissions   my last submissions
  POST /practice/generate                   ask the AI for a new problem (5 a day per person)
"""
import time
from collections import defaultdict, deque
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from .. import auth, models
from ..database import get_db
from ..services import judge as J
from ..services import practice_service as PS
from ..services.question_generator import GenerationError, canonical_skill
from ..utils.timezone import enforce_utc_iso, utc_now

router = APIRouter(prefix="/practice", tags=["practice"])

MAX_CODE = 50_000
RUNS_PER_MINUTE = 20          # Run + Submit per person; the code runner is shared
AI_PROBLEMS_PER_DAY = 5
_recent_runs = defaultdict(deque)


class CodeIn(BaseModel):
    language: str = Field(..., pattern="^(python|java|javascript|sql)$")
    code: str = Field(..., max_length=MAX_CODE)


class GenerateIn(BaseModel):
    course: str = Field(..., min_length=1, max_length=60)
    difficulty: str = Field("Easy", pattern="^(Easy|Medium|Hard)$")
    topic: Optional[str] = Field(None, max_length=60)


def _rate_limit(user_id: int) -> None:
    now = time.monotonic()
    q = _recent_runs[user_id]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RUNS_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Slow down a little: too many runs in one minute.")
    q.append(now)


def _problem(db: Session, slug: str) -> models.PracticeProblem:
    PS.ensure_bank(db)
    p = db.query(models.PracticeProblem).filter(models.PracticeProblem.slug == slug).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
    return p


def _status_map(db: Session, user_id: int) -> dict:
    rows = (db.query(models.PracticeSubmission.problem_id, models.PracticeSubmission.verdict)
            .filter(models.PracticeSubmission.user_id == user_id).all())
    out = {}
    for pid, verdict in rows:
        if verdict == "Accepted":
            out[pid] = "solved"
        else:
            out.setdefault(pid, "attempted")
    return out


@router.get("/courses")
def list_courses(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    PS.ensure_bank(db)
    counts = dict(db.query(models.PracticeProblem.course, func.count(models.PracticeProblem.id))
                  .group_by(models.PracticeProblem.course).all())
    status = _status_map(db, current_user.id)
    solved_by_course = defaultdict(int)
    if status:
        for pid, course in db.query(models.PracticeProblem.id, models.PracticeProblem.course).filter(
                models.PracticeProblem.id.in_(list(status))).all():
            if status[pid] == "solved":
                solved_by_course[course] += 1
    mine = [us.skill.name for us in db.query(models.UserSkill).filter(models.UserSkill.user_id == current_user.id).all()]
    names = list(PS.PRACTICE_COURSES) + [c for c in counts if c not in PS.PRACTICE_COURSES] + \
        [canonical_skill(m) for m in mine if canonical_skill(m) not in counts and canonical_skill(m) not in PS.PRACTICE_COURSES]
    return [{"course": c, "problems": counts.get(c, 0), "solved": solved_by_course.get(c, 0),
             "default_language": PS.default_language(c), "mine": c in [canonical_skill(m) for m in mine]}
            for c in dict.fromkeys(names)]


@router.get("/problems")
def list_problems(
    course: Optional[str] = Query(None, max_length=60),
    difficulty: Optional[str] = Query(None, pattern="^(Easy|Medium|Hard)$"),
    q: Optional[str] = Query(None, max_length=60),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    PS.ensure_bank(db)
    query = db.query(models.PracticeProblem)
    if course:
        query = query.filter(func.lower(models.PracticeProblem.course) == canonical_skill(course).lower())
    if difficulty:
        query = query.filter(models.PracticeProblem.difficulty == difficulty)
    if q:
        query = query.filter(models.PracticeProblem.title.ilike(f"%{q.replace('%', '').replace('_', '')}%"))
    order = {"Easy": 0, "Medium": 1, "Hard": 2}
    problems = sorted(query.all(), key=lambda p: (order.get(p.difficulty, 3), p.source != "bank", p.id))
    status = _status_map(db, current_user.id)
    return [{"slug": p.slug, "title": p.title, "course": p.course, "difficulty": p.difficulty,
             "topics": p.topics or [], "kind": p.kind, "source": p.source, "status": status.get(p.id)}
            for p in problems]


@router.get("/problems/{slug}")
def get_problem(slug: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    p = _problem(db, slug)
    out = PS.public_problem(p)
    last = {}
    for s in (db.query(models.PracticeSubmission).filter_by(user_id=current_user.id, problem_id=p.id)
              .order_by(models.PracticeSubmission.id.desc()).limit(30).all()):
        last.setdefault(s.language, s.code)
    out["my_code"] = last
    out["status"] = _status_map(db, current_user.id).get(p.id)
    return out


@router.post("/problems/{slug}/run")
async def run_problem(slug: str, payload: CodeIn, current_user: models.User = Depends(auth.get_current_user),
                      db: Session = Depends(get_db)):
    p = _problem(db, slug)
    if payload.language not in PS.languages_for(p.kind):
        raise HTTPException(status_code=400, detail="That language isn't available for this problem.")
    _rate_limit(current_user.id)
    return await run_in_threadpool(J.judge, p.spec, payload.language, payload.code, "sample")


@router.post("/problems/{slug}/submit")
async def submit_problem(slug: str, payload: CodeIn, current_user: models.User = Depends(auth.get_current_user),
                         db: Session = Depends(get_db)):
    p = _problem(db, slug)
    if payload.language not in PS.languages_for(p.kind):
        raise HTTPException(status_code=400, detail="That language isn't available for this problem.")
    _rate_limit(current_user.id)
    result = await run_in_threadpool(J.judge, p.spec, payload.language, payload.code, "all")
    if result["verdict"] in ("Runner Unavailable", "Runner Busy", "No Code"):
        return {**result, "points": 0}       # not the learner's fault: don't record it
    solved_before = db.query(models.PracticeSubmission).filter_by(
        user_id=current_user.id, problem_id=p.id, verdict="Accepted").first() is not None
    db.add(models.PracticeSubmission(user_id=current_user.id, problem_id=p.id, language=payload.language,
                                     code=payload.code, verdict=result["verdict"], passed=result["passed"],
                                     total=result["total"]))
    points = 0
    if result["verdict"] == "Accepted" and not solved_before:
        points = PS.SOLVE_POINTS.get(p.difficulty, 10)
        current_user.points = (current_user.points or 0) + points
    db.commit()
    # Hidden tests: show which failed, never their expected answers.
    return {**result, "points": points}


@router.get("/problems/{slug}/submissions")
def my_submissions(slug: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    p = _problem(db, slug)
    rows = (db.query(models.PracticeSubmission).filter_by(user_id=current_user.id, problem_id=p.id)
            .order_by(models.PracticeSubmission.id.desc()).limit(20).all())
    return [{"id": s.id, "language": s.language, "verdict": s.verdict, "passed": s.passed, "total": s.total,
             "code": s.code, "created_at": enforce_utc_iso(s.created_at) if s.created_at else None}
            for s in rows]


@router.post("/generate")
async def generate_problem(payload: GenerateIn, current_user: models.User = Depends(auth.get_current_user),
                           db: Session = Depends(get_db)):
    """Ask the AI for one new problem. Its reference solution must pass every test
    before the problem is saved, so broken AI problems never reach learners."""
    since = utc_now() - timedelta(days=1)
    made_today = db.query(models.PracticeProblem).filter(
        models.PracticeProblem.created_by == current_user.id, models.PracticeProblem.created_at > since).count()
    if made_today >= AI_PROBLEMS_PER_DAY:
        raise HTTPException(status_code=429, detail=f"You can create {AI_PROBLEMS_PER_DAY} new problems a day. Try the existing ones!")
    try:
        problems = await run_in_threadpool(PS.create_ai_problems, db, payload.course, payload.difficulty,
                                           current_user.id, payload.topic, 1)
    except GenerationError as err:
        raise HTTPException(status_code=503, detail=f"The AI couldn't write a problem right now. {err}")
    p = problems[0]
    return {"slug": p.slug, "title": p.title}
