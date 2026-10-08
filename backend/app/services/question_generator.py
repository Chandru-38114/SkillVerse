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
import logging
import os
import random
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


# ── Configuration ────────────────────────────────────────────────────────────

def _models() -> List[str]:
    raw = os.getenv("GEMINI_MODELS", "gemini-3.6-flash,gemini-3.5-flash-lite")
    return [m.strip() for m in raw.split(",") if m.strip()]


N_MCQ = int(os.getenv("ARENA_N_MCQ", "6"))
N_TRACE = int(os.getenv("ARENA_N_TRACE", "3"))
N_DEBUG = int(os.getenv("ARENA_N_DEBUG", "1"))
MIN_VALID = int(os.getenv("ARENA_MIN_VALID", "7"))  # fewer usable items than this -> try next model


def _prompt(skill: str, level_hint: Optional[str]) -> str:
    topics = SKILL_TOPICS.get(skill)
    topic_line = (
        f"Tag every question with exactly one topic from this list: {', '.join(topics)}. Spread questions across topics."
        if topics else
        "Tag every question with one short topic name (1-3 words). Spread questions across different topics."
    )
    level_line = f"Target difficulty: {level_hint}." if level_hint else "Mix easy, medium and hard questions."
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


# ── Gemini call with model fallback and 503 backoff ──────────────────────────

def _is_overloaded(err: Exception) -> bool:
    msg = str(err)
    return any(s in msg for s in ("503", "UNAVAILABLE", "high demand", "overloaded"))


def _call_model(client, model: str, prompt: str, retries: int = 3, delay: float = 1.5) -> _GenAssessment:
    for attempt in range(1, retries + 1):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_GenAssessment,
                    temperature=0.9,
                ),
            )
            if getattr(resp, "parsed", None) is not None:
                return resp.parsed
            return _GenAssessment.model_validate_json(resp.text or "{}")
        except Exception as err:  # noqa: BLE001 - SDK raises several error types
            if _is_overloaded(err) and attempt < retries:
                logger.warning("[arena] %s overloaded (attempt %d/%d), retrying in %.1fs", model, attempt, retries, delay)
                time.sleep(delay)
                delay *= 2
                continue
            raise
    raise GenerationError(f"{model}: retries exhausted")


def generate_assessment(skill_name: str, level_hint: Optional[str] = None) -> List[dict]:
    """Return a list of questions WITH answers. Raises GenerationError if AI is unavailable."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not HAS_GENAI or not api_key:
        raise GenerationError("Gemini is not configured (missing google-genai or GEMINI_API_KEY).")

    skill = canonical_skill(skill_name)
    prompt = _prompt(skill, level_hint)
    client = genai.Client(api_key=api_key)

    last_error: Optional[Exception] = None
    for model in _models():
        try:
            questions = _to_questions(_call_model(client, model, prompt), skill)
            if len(questions) >= MIN_VALID:
                logger.info("[arena] generated %d questions for %s with %s", len(questions), skill, model)
                return questions
            last_error = GenerationError(f"{model} returned only {len(questions)} valid questions")
            logger.warning("[arena] %s", last_error)
        except Exception as err:  # noqa: BLE001
            last_error = err
            logger.warning("[arena] generation failed with %s: %s", model, err)
    raise GenerationError(str(last_error) if last_error else "No models configured")


def sanitize(questions: List[dict]) -> List[dict]:
    """What the browser is allowed to see: no answer, no explanation."""
    return [
        {"id": q["id"], "topic": q["topic"], "type": q["type"], "question": q["question"], "options": q.get("options", [])}
        for q in questions
    ]
