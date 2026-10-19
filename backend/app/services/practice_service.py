"""
Practice problems: saving them (bank or AI), what the browser may see, and which
languages each course uses. Used by routers/practice.py and the Skill Arena.
"""
import json
import logging
import random
import re
import threading
import uuid
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models
from ..data.practice_bank import PRACTICE_BANK
from . import judge as J
from .question_generator import GenerationError, canonical_skill, generate_practice_problems

logger = logging.getLogger(__name__)

FUNCTION_LANGUAGES = ["python", "java", "javascript"]
# Language a course opens in (learners can still switch for function problems).
COURSE_DEFAULT_LANGUAGE = {
    "Python": "python", "Java": "java", "Data Structures and Algorithms": "python",
    "Web Development": "javascript", "JavaScript": "javascript", "SQL": "sql",
}
# Courses with built-in problems, in the order the Practice page shows them.
PRACTICE_COURSES = ["Data Structures and Algorithms", "Python", "Java", "Web Development", "SQL"]
DIFFICULTIES = ("Easy", "Medium", "Hard")
SOLVE_POINTS = {"Easy": 10, "Medium": 20, "Hard": 30}

# Skill Arena: which courses get coding questions, and in which languages.
ARENA_CODING = {
    "Python": ["python"],
    "Java": ["java"],
    "Data Structures and Algorithms": ["python", "java", "javascript"],
    "Web Development": ["javascript"],
    "JavaScript": ["javascript"],
    "SQL": ["sql"],
}


def default_language(course: str) -> str:
    return COURSE_DEFAULT_LANGUAGE.get(canonical_skill(course), "python")


def languages_for(kind: str) -> List[str]:
    return ["sql"] if kind == "sql" else list(FUNCTION_LANGUAGES)


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    return s or "problem"


# ---------------------------------------------------------------------------
# Building a checked spec from a bank entry or AI output
# ---------------------------------------------------------------------------
def build_spec(raw: dict) -> dict:
    """Validate a raw problem and compute expected answers with its reference
    solution. Raises judge.SpecError if anything is wrong."""
    if raw.get("kind") == "sql":
        schema = (raw.get("schema") or "").strip()
        if not schema.upper().startswith("CREATE TABLE"):
            raise J.SpecError("SQL problems need CREATE TABLE statements")
        tests = raw.get("tests") or []
        if not (1 <= len(tests) <= 6):
            raise J.SpecError("1 to 6 datasets")
        return {"kind": "sql", "schema": schema, "ordered": bool(raw.get("ordered")),
                "tests": J.compute_sql_expected(schema, raw["reference"], tests)}
    sig = J.validate_signature(raw["signature"])
    tests = J.validate_tests(sig, raw["tests"], need_expected=False)
    return {"kind": "function", "signature": sig, "any_order": bool(raw.get("any_order")),
            "tests": J.compute_expected(sig, raw["reference"], tests)}


def _from_ai(p: dict) -> dict:
    """Turn the AI's answer into the same shape as a bank entry."""
    if p.get("kind") == "sql":
        return {"kind": "sql", "schema": p.get("sql_schema", ""), "reference": p.get("sql_reference", ""),
                "ordered": p.get("ordered", False),
                "tests": [{"data": d.get("insert_sql", ""), "sample": d.get("sample", False)} for d in p.get("sql_datasets", [])]}
    tests = []
    for t in p.get("tests", []):
        try:
            args = json.loads(t.get("args_json", ""))
        except ValueError:
            continue
        tests.append({"args": args, "sample": t.get("sample", False)})
    sig = {"function": p.get("function_name", ""), "params": p.get("params", []), "returns": p.get("returns", "")}
    if p.get("returns") == "void":
        sig["output_param"] = p.get("output_param", "")
    return {"kind": "function", "signature": sig, "tests": tests, "reference": p.get("reference_python", ""),
            "any_order": p.get("any_order", False)}


# ---------------------------------------------------------------------------
# The built-in bank
# ---------------------------------------------------------------------------
_seeded = False
_seed_lock = threading.Lock()


def ensure_bank(db: Session) -> None:
    """Insert any bank problem that isn't in the database yet (once per process).
    Two first requests can arrive together (the Practice page loads courses and
    problems at once), so seeding is locked; another server process seeding at the
    same moment is handled by the unique slug (we roll back and carry on)."""
    global _seeded
    if _seeded:
        return
    with _seed_lock:
        if _seeded:
            return
        have = {s for (s,) in db.query(models.PracticeProblem.slug).all()}
        for raw in PRACTICE_BANK:
            if raw["slug"] in have:
                continue
            try:
                spec = build_spec(raw)
            except Exception as err:  # noqa: BLE001 - a broken bank entry must not break the page
                logger.error("[practice] bank problem %s is invalid: %s", raw["slug"], err)
                continue
            db.add(models.PracticeProblem(
                slug=raw["slug"], course=raw["course"], title=raw["title"], difficulty=raw["difficulty"],
                topics=raw.get("topics", []), statement=raw["statement"], constraints=raw.get("constraints", []),
                kind=raw.get("kind", "function"), spec=spec, reference=raw["reference"], source="bank",
            ))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()       # another process inserted them first: that's fine
        _seeded = True


# ---------------------------------------------------------------------------
# AI problems
# ---------------------------------------------------------------------------
def create_ai_problems(db: Session, course: str, difficulty: str, user_id: Optional[int] = None,
                       topic: Optional[str] = None, count: int = 1, save: bool = True) -> List[models.PracticeProblem]:
    """Ask the AI for problems, check every one by running its reference solution,
    keep only the ones that pass. Raises GenerationError if none survive."""
    course = canonical_skill(course)
    kind = "sql" if course == "SQL" else "function"
    avoid = [t for (t,) in db.query(models.PracticeProblem.title).filter(models.PracticeProblem.course == course).limit(60).all()]
    raw_problems = generate_practice_problems(course, difficulty, count=count, topic=topic, kind=kind, avoid=avoid)
    made = []
    for p in raw_problems:
        try:
            raw = _from_ai(p)
            spec = build_spec(raw)
        except Exception as err:  # noqa: BLE001
            logger.warning("[practice] AI problem rejected (%s): %s", p.get("title"), err)
            continue
        title = (p.get("title") or "Practice problem").strip()[:150]
        slug = f"{slugify(title)}-{uuid.uuid4().hex[:6]}"
        prob = models.PracticeProblem(
            slug=slug, course=course, title=title, difficulty=difficulty if difficulty in DIFFICULTIES else "Easy",
            topics=[(p.get("topic") or "General").strip()[:60]], statement=(p.get("statement") or "").strip()[:8000],
            constraints=[str(c)[:200] for c in (p.get("constraints") or [])][:8], kind=spec["kind"], spec=spec,
            reference=raw.get("reference", ""), source="ai", created_by=user_id,
        )
        if save:
            db.add(prob)
        made.append(prob)
    if save and made:
        db.commit()
    if not made:
        raise GenerationError("The AI's problems didn't pass our checks. Please try again.")
    return made


# ---------------------------------------------------------------------------
# What the browser may see
# ---------------------------------------------------------------------------
def examples(spec: dict) -> list:
    out = []
    for t in spec["tests"]:
        if not t.get("sample"):
            continue
        if spec["kind"] == "sql":
            out.append({"input": t.get("data", ""), "output": t["expected"]})
        else:
            out.append({"input": J.describe_args(spec["signature"], t["args"]), "output": t["expected"]})
    return out


def public_problem(p: models.PracticeProblem) -> dict:
    spec = p.spec
    langs = languages_for(p.kind)
    default = default_language(p.course) if default_language(p.course) in langs else langs[0]
    return {
        "slug": p.slug, "title": p.title, "course": p.course, "difficulty": p.difficulty,
        "topics": p.topics or [], "statement": p.statement, "constraints": p.constraints or [],
        "kind": p.kind, "languages": langs, "default_language": default,
        "starter": {lang: J.starter_code(spec, lang) for lang in langs},
        "examples": examples(spec),
        "schema": spec.get("schema") if p.kind == "sql" else None,
        "signature": spec.get("signature") if p.kind != "sql" else None,
        "test_count": len(spec["tests"]), "source": p.source,
    }


# ---------------------------------------------------------------------------
# Skill Arena coding questions
# ---------------------------------------------------------------------------
def arena_coding_questions(db: Session, course: str, level: str, count: int = 2, use_ai: bool = True) -> List[dict]:
    """Coding questions for a Skill Arena attempt: AI-written when possible, else
    from the Practice bank for that course. [] for courses without coding."""
    course = canonical_skill(course)
    langs = ARENA_CODING.get(course)
    if not langs or count <= 0:
        return []
    difficulty = {"beginner": "Easy", "intermediate": "Easy", "expert": "Medium"}.get((level or "").lower(), "Easy")
    problems: List[models.PracticeProblem] = []
    if use_ai:
        try:
            problems = create_ai_problems(db, course, difficulty, count=count, save=False)
        except Exception as err:  # noqa: BLE001
            logger.warning("[arena] AI coding questions unavailable for %s: %s", course, err)
    if len(problems) < count:
        ensure_bank(db)
        pool = db.query(models.PracticeProblem).filter(models.PracticeProblem.course == course,
                                                         models.PracticeProblem.source == "bank").all()
        random.shuffle(pool)
        problems += pool[:count - len(problems)]
    return [to_arena_question(p, langs) for p in problems[:count]]


def to_arena_question(p: models.PracticeProblem, langs: List[str]) -> dict:
    allowed = [lang for lang in langs if lang in languages_for(p.kind)] or languages_for(p.kind)
    return {
        "id": f"code-{uuid.uuid4().hex[:10]}", "type": "coding", "marks": 5,
        "topic": (p.topics or ["Coding"])[0], "title": p.title, "question": p.statement,
        "spec": p.spec, "languages": allowed,
    }


def arena_public_coding(q: dict) -> dict:
    """Browser view of an Arena coding question: statement, examples, starter code. No hidden tests."""
    spec = q["spec"]
    return {
        "id": q["id"], "topic": q["topic"], "type": "coding", "marks": q["marks"], "title": q["title"],
        "question": q["question"], "languages": q["languages"],
        "starter": {lang: J.starter_code(spec, lang) for lang in q["languages"]},
        "examples": examples(spec), "kind": spec["kind"], "schema": spec.get("schema"),
        "test_count": len(spec["tests"]),
    }


def parse_coding_answer(answer: str, allowed: List[str]) -> tuple:
    """Arena answers for coding questions arrive as JSON {"language", "code"} (older
    clients sent plain code). Returns (language, code)."""
    try:
        data = json.loads(answer)
        if isinstance(data, dict) and isinstance(data.get("code"), str):
            lang = data.get("language") if data.get("language") in allowed else allowed[0]
            return lang, data["code"]
    except (ValueError, TypeError):
        pass
    return allowed[0], answer or ""
