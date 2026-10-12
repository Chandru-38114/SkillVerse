import logging
from typing import Dict, List

from .question_generator import generate_text

logger = logging.getLogger(__name__)

MIN_LINES = 3
MAX_LINES = 10

NEXT_SESSION_MIN_LINES = 3
NEXT_SESSION_MAX_LINES = 7


def _clean_lines(text: str) -> List[str]:
    lines = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("-*•").strip()
        line = line.lstrip("0123456789").lstrip(".):").strip()
        if line:
            lines.append(line)
    return lines


def _template_fallback(weak_topics: List[str]) -> List[str]:
    if not weak_topics:
        return ["You're solid across the board — consider teaching this skill to others."]
    return [f"Day {i + 1}: Focus on {topic}" for i, topic in enumerate(weak_topics)]


def _next_session_fallback(missed_topics: List[str]) -> List[str]:
    if not missed_topics:
        return ["Review the session's topics once more, then move on to new material."]
    return [f"Next session: revisit {topic}" for topic in missed_topics]


def build_study_plan(
    skill: str,
    level: str,
    score: float,
    weak_topics: List[str],
    topic_mastery: Dict[str, float],
) -> List[str]:
    """Return 3-10 AI-generated study steps, falling back to a template on any failure."""
    try:
        mastery_lines = "\n".join(f"- {topic}: {pct:.0f}%" for topic, pct in topic_mastery.items())
        weak_line = ", ".join(weak_topics) if weak_topics else "none - all topics above the weak threshold"
        prompt = f"""
        You are an AI assistant building a short next-steps study roadmap for a learner
        who just finished a "{skill}" assessment.

        Level reached: {level}
        Overall score: {score}%
        Weak topics: {weak_line}
        Per-topic mastery:
        {mastery_lines}

        Write 5 to 7 short, concrete, ordered steps the learner should take next.

        STRICT RULES:
        - Use ONLY the topics supplied above. Never invent a topic.
        - Never state or imply a skill level beyond the one supplied.
        - Never promise outcomes or guarantee improvement.
        - Each step is one line, under 20 words, no markdown.
        - Each step must name a specific topic from the list above and say what to practise.
        """

        text = generate_text(prompt, timeout=20)
        if not text:
            raise ValueError("no AI response")

        lines = _clean_lines(text)
        if not (MIN_LINES <= len(lines) <= MAX_LINES):
            raise ValueError(f"unusable line count: {len(lines)}")

        return lines
    except Exception as err:  # noqa: BLE001
        logger.warning("[arena] AI study plan unavailable for %s: %s", skill, err)
        return _template_fallback(weak_topics)


def build_next_session_plan(
    skill: str,
    summary: str,
    score: float,
    missed_topics: List[str],
    weak_topics: List[str],
) -> List[str]:
    """Return 3-7 AI-generated lines describing what the NEXT session should cover,
    falling back to a deterministic list built from missed_topics on any failure."""
    try:
        missed_line = ", ".join(missed_topics) if missed_topics else "none - the learner answered everything correctly"
        weak_line = ", ".join(weak_topics) if weak_topics else "none recorded"
        prompt = f"""
        You are an AI assistant planning what the NEXT "{skill}" learning session should
        cover, based on what just happened in the previous session.

        What the previous session covered:
        {summary}

        Post-session check score: {score}%
        Topics missed on the post-session check: {missed_line}
        Standing weak topics from the Skill Arena: {weak_line}

        Write 3 to 5 short, ordered lines describing what the next session should cover.

        STRICT RULES:
        - Use ONLY the topics supplied above. Never invent a topic.
        - Never promise outcomes or guarantee improvement.
        - Each line is one line, under 20 words, no markdown.
        - Each line must name a specific topic from the supplied topics.
        """

        text = generate_text(prompt, timeout=20)
        if not text:
            raise ValueError("no AI response")

        lines = _clean_lines(text)
        if not (NEXT_SESSION_MIN_LINES <= len(lines) <= NEXT_SESSION_MAX_LINES):
            raise ValueError(f"unusable line count: {len(lines)}")

        return lines
    except Exception as err:  # noqa: BLE001
        logger.warning("[arena] AI next-session plan unavailable for %s: %s", skill, err)
        return _next_session_fallback(missed_topics)
