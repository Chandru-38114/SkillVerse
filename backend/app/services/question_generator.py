"""
AI question generation for the Skill Arena.

Python port of the Gemini prompt + JSON schema from the AI-Api-Application
(app/api/assessment/generate/route.ts), with three changes:

1. Answer keys never leave the server. This module returns questions WITH
   answers; the router stores them and only sends sanitized copies to the
   browser.
2. Every generated item is validated (4 distinct options, a valid correct
   index, non-empty text). Invalid items are dropped; if too few survive,
   the next model is tried.
3. Options are shuffled, because models tend to put the right answer first.

Question types map onto what the Skill Arena already renders:
    MCQ               -> type "mcq"
    code tracing      -> type "output"  (snippet appended to the question)
    debugging         -> type "mcq"     (buggy snippet appended to the question)
"""
import json
import logging
import os
import random
import re
import time
import uuid
from typing import List, Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:  # pragma: no cover - only when the package is missing
    HAS_GENAI = False
    logger.warning("google-genai is not installed; AI question generation is disabled.")


class GenerationError(Exception):
    """Raised when no model produced a usable assessment."""


# ── Skills and their topic lists (keeps weak-topic analysis consistent) ──────

SKILL_ALIASES = {
    "python": "Python",
    "java": "Java",
    "dsa": "Data Structures and Algorithms",
    "data structures": "Data Structures and Algorithms",
    "data structures and algorithms": "Data Structures and Algorithms",
    "web development": "Web Development",
    "web dev": "Web Development",
    "webdev": "Web Development",
}

SKILL_TOPICS = {
    "Python": ["Variables and Types", "Control Flow", "Functions", "Data Structures", "OOP", "Exceptions", "Recursion"],
    "Java": ["OOP", "Control Flow", "Strings", "Collections", "Exceptions", "Generics", "Memory and JVM"],
    "Data Structures and Algorithms": ["Arrays", "Linked Lists", "Stacks and Queues", "Trees", "Graphs", "Sorting and Searching", "Complexity"],
    "Web Development": ["HTML", "CSS", "JavaScript", "DOM", "HTTP and APIs", "Asynchronous JavaScript"],
}


def canonical_skill(skill_name: str) -> str:
    key = " ".join(skill_name.strip().lower().split())
    return SKILL_ALIASES.get(key, skill_name.strip())


CODING_SKILLS = {"Python", "Data Structures and Algorithms"}


def supports_coding(skill: str) -> bool:
    return skill in CODING_SKILLS


LEVELS = {
    "beginner": "Beginner: stick to fundamentals, simple syntax and short, obvious logic.",
    "intermediate": "Intermediate: everyday problem-solving, some multi-step logic.",
    "expert": "Expert: trickier edge cases, more advanced language features and less obvious logic.",
}


def canonical_level(level: Optional[str]) -> str:
    key = (level or "").strip().lower()
    return key if key in LEVELS else "intermediate"


# ── Structured-output schema (mirrors route.ts, plus a `topic` per item) ─────

class _GenMCQ(BaseModel):
    topic: str
    question: str
    options: List[str]
    correct_option_index: int
    explanation: str


class _GenTrace(_GenMCQ):
    snippet: str


class _GenDebug(_GenMCQ):
    buggy_snippet: str


class _GenAssessment(BaseModel):
    mcqs: List[_GenMCQ]
    logic_questions: List[_GenTrace]
    debugging_questions: List[_GenDebug]


class _GenTestCase(BaseModel):
    args_json: str
    expected_json: str


class _GenCodingProblem(BaseModel):
    topic: str
    title: str
    problem: str
    function_name: str
    starter_code: str
    test_cases: List[_GenTestCase]


class _GenCodingSet(BaseModel):
    problems: List[_GenCodingProblem]


# ── Configuration ────────────────────────────────────────────────────────────

def _models() -> List[str]:
    raw = os.getenv("GEMINI_MODELS", "gemini-3.6-flash,gemini-3.5-flash-lite")
    return [m.strip() for m in raw.split(",") if m.strip()]


N_MCQ = int(os.getenv("ARENA_N_MCQ", "12"))
N_TRACE = int(os.getenv("ARENA_N_TRACE", "5"))
N_DEBUG = int(os.getenv("ARENA_N_DEBUG", "3"))
N_CODING = int(os.getenv("ARENA_N_CODING", "2"))
MIN_VALID = int(os.getenv("ARENA_MIN_VALID", "14"))  # fewer usable items than this -> try next model
MIN_TEST_CASES = 3


def _prompt(skill: str, level: str) -> str:
    topics = SKILL_TOPICS.get(skill)
    topic_line = (
        f"Tag every question with exactly one topic from this list: {', '.join(topics)}. Spread questions across topics."
        if topics else
        "Tag every question with one short topic name (1-3 words). Spread questions across different topics."
    )
    level_line = f"Target difficulty: {LEVELS.get(level, LEVELS['intermediate'])}"
    return f"""Generate a technical skill assessment for "{skill}".
Return EXACTLY:
- {N_MCQ} multiple-choice concept questions (mcqs)
- {N_TRACE} code-tracing questions where the student predicts the output of a short snippet (logic_questions)
- {N_DEBUG} debugging question(s) where the snippet contains one intentional bug and the options are possible fixes (debugging_questions)
Rules:
- Every question has exactly 4 options, exactly one of them correct, and no two options identical.
- correct_option_index is the 0-based index of the correct option.
- Snippets are short (under 12 lines), self-contained and written in a language appropriate for "{skill}".
- Do not put the code inside the question text; put it in snippet or buggy_snippet.
- Explanations are one or two sentences.
- {topic_line}
- {level_line}"""


def _coding_prompt(skill: str, level: str) -> str:
    level_line = LEVELS.get(level, LEVELS["intermediate"])
    return f"""Generate {N_CODING} Python problem-solving exercises for a "{skill}" assessment.
Target difficulty: {level_line}

For each problem return:
- topic: a short topic name
- title: a short title
- problem: the problem statement in plain language, with NO example code or sample solution in it
- function_name: a valid Python identifier for the function the student must write (snake_case, not starting with "_")
- starter_code: a stub like "def {{function_name}}(...):\\n    pass"
- test_cases: exactly 5 test cases, each with:
    - args_json: a JSON array string of the arguments to pass, in order
    - expected_json: a JSON string of the exact value the function must RETURN

Hard rules:
- The function must RETURN its answer, never print it.
- Use only plain JSON-safe data: integers, strings, booleans, lists, dicts. No floats, no randomness,
  no sets, nothing that depends on dict/set ordering, no dates or times.
- The solution may only need: the builtins, plus the math, collections, itertools and datetime modules.
- Test cases must be deterministic and fully specified by args_json and expected_json."""


# ── Validation and conversion ────────────────────────────────────────────────

def _clean_options(options: List[str]) -> Optional[List[str]]:
    opts = [str(o).strip() for o in options]
    if len(opts) != 4 or any(not o for o in opts):
        return None
    if len({o.lower() for o in opts}) != 4:
        return None
    return opts


def _convert(item: _GenMCQ, qtype: str, code: Optional[str], allowed_topics: Optional[List[str]]) -> Optional[dict]:
    opts = _clean_options(item.options)
    if opts is None or not (0 <= item.correct_option_index < 4) or not item.question.strip():
        return None
    answer = opts[item.correct_option_index]
    random.shuffle(opts)
    topic = item.topic.strip() or "General"
    if allowed_topics and topic not in allowed_topics:
        # Snap near-misses ("functions" -> "Functions"); otherwise keep the model's label.
        match = next((t for t in allowed_topics if t.lower() == topic.lower()), None)
        topic = match or topic
    question = item.question.strip()
    if code and code.strip():
        question = f"{question}\n\n{code.strip()}"
    return {
        "id": f"ai-{uuid.uuid4().hex[:10]}",
        "topic": topic,
        "type": qtype,
        "marks": 1,
        "question": question,
        "options": opts,
        "answer": answer,
        "explanation": item.explanation.strip(),
    }


def _to_questions(gen: _GenAssessment, skill: str) -> List[dict]:
    allowed = SKILL_TOPICS.get(skill)
    out = []
    out += [q for q in (_convert(m, "mcq", None, allowed) for m in gen.mcqs[:N_MCQ]) if q]
    out += [q for q in (_convert(t, "output", t.snippet, allowed) for t in gen.logic_questions[:N_TRACE]) if q]
    out += [q for q in (_convert(d, "mcq", d.buggy_snippet, allowed) for d in gen.debugging_questions[:N_DEBUG]) if q]
    return out


_FUNC_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _convert_coding(item: _GenCodingProblem, allowed_topics: Optional[List[str]]) -> Optional[dict]:
    name = item.function_name.strip()
    if not _FUNC_NAME_RE.match(name) or name.startswith("_"):
        return None
    if not item.problem.strip() or not item.title.strip():
        return None

    tests = []
    for tc in item.test_cases:
        try:
            args = json.loads(tc.args_json)
            expected = json.loads(tc.expected_json)
        except (ValueError, TypeError):
            continue
        if not isinstance(args, list):
            continue
        tests.append({"args": args, "expected": expected})
    if len(tests) < MIN_TEST_CASES:
        return None

    topic = item.topic.strip() or "General"
    if allowed_topics and topic not in allowed_topics:
        match = next((t for t in allowed_topics if t.lower() == topic.lower()), None)
        topic = match or topic

    return {
        "id": f"ai-code-{uuid.uuid4().hex[:10]}",
        "topic": topic,
        "type": "coding",
        "marks": 5,
        "title": item.title.strip(),
        "question": item.problem.strip(),
        "function_name": name,
        "starter_code": item.starter_code.strip(),
        "tests": tests,
    }


def _to_coding_questions(gen: _GenCodingSet, skill: str) -> List[dict]:
    allowed = SKILL_TOPICS.get(skill)
    return [q for q in (_convert_coding(p, allowed) for p in gen.problems[:N_CODING]) if q]


# ── Gemini call with model fallback and 503 backoff ──────────────────────────

def _is_overloaded(err: Exception) -> bool:
    msg = str(err)
    return any(s in msg for s in ("503", "UNAVAILABLE", "high demand", "overloaded"))


def _call_model(client, model: str, prompt: str, schema, retries: int = 3, delay: float = 1.5):
    for attempt in range(1, retries + 1):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.9,
                ),
            )
            if getattr(resp, "parsed", None) is not None:
                return resp.parsed
            return schema.model_validate_json(resp.text or "{}")
        except Exception as err:  # noqa: BLE001 - SDK raises several error types
            if _is_overloaded(err) and attempt < retries:
                logger.warning("[arena] %s overloaded (attempt %d/%d), retrying in %.1fs", model, attempt, retries, delay)
                time.sleep(delay)
                delay *= 2
                continue
            raise
    raise GenerationError(f"{model}: retries exhausted")


def _generate_coding_questions(client, skill: str, level: str) -> List[dict]:
    prompt = _coding_prompt(skill, level)
    for model in _models():
        try:
            gen = _call_model(client, model, prompt, _GenCodingSet)
            problems = _to_coding_questions(gen, skill)
            if problems:
                return problems
        except Exception as err:  # noqa: BLE001
            logger.warning("[arena] coding generation failed with %s: %s", model, err)
    return []


def generate_assessment(skill_name: str, level: Optional[str] = None) -> List[dict]:
    """Return a list of questions WITH answers. Raises GenerationError if AI is unavailable."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not HAS_GENAI or not api_key:
        raise GenerationError("Gemini is not configured (missing google-genai or GEMINI_API_KEY).")

    skill = canonical_skill(skill_name)
    level = canonical_level(level)
    prompt = _prompt(skill, level)
    client = genai.Client(api_key=api_key)

    last_error: Optional[Exception] = None
    for model in _models():
        try:
            questions = _to_questions(_call_model(client, model, prompt, _GenAssessment), skill)
            if len(questions) >= MIN_VALID:
                logger.info("[arena] generated %d questions for %s with %s", len(questions), skill, model)
                if supports_coding(skill):
                    try:
                        questions += _generate_coding_questions(client, skill, level)
                    except Exception as err:  # noqa: BLE001
                        logger.warning("[arena] coding questions unavailable for %s: %s", skill, err)
                return questions
            last_error = GenerationError(f"{model} returned only {len(questions)} valid questions")
            logger.warning("[arena] %s", last_error)
        except Exception as err:  # noqa: BLE001
            last_error = err
            logger.warning("[arena] generation failed with %s: %s", model, err)
    raise GenerationError(str(last_error) if last_error else "No models configured")


def sanitize(questions: List[dict]) -> List[dict]:
    """What the browser is allowed to see: no answer, no explanation, no tests."""
    out = []
    for q in questions:
        if q["type"] == "coding":
            first = q["tests"][0]
            out.append({
                "id": q["id"], "topic": q["topic"], "type": q["type"], "marks": q["marks"],
                "title": q["title"], "question": q["question"],
                "function_name": q["function_name"], "starter_code": q["starter_code"],
                "test_count": len(q["tests"]),
                "example": {"args": first["args"], "expected": first["expected"]},
            })
        else:
            out.append({
                "id": q["id"], "topic": q["topic"], "type": q["type"], "marks": q.get("marks", 1),
                "question": q["question"], "options": q.get("options", []),
            })
    return out
