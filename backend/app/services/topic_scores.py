"""
Per-topic scores and the post-session reassessment (features 0 and 1).

Every Skill Arena attempt and every post-session reassessment saves one
TopicScore row per topic (0-100). That history is what lets SkillVerse measure
real learning: a learner's topic scores BEFORE and AFTER sessions with a tutor
(teaching impact) and which topics are weak (tutor recommendations).
"""
import copy
import random
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from .. import models
from ..data.questions import get_questions_for_skill
from ..utils.levels import score_to_level
from ..utils.timezone import utc_now

REASSESS_WEIGHT = 0.3        # a reassessment moves the skill score 30% of the way
FALLBACK_QUIZ_SIZE = 6       # questions when the AI is unavailable
MIN_FALLBACK_QUESTIONS = 4


def per_topic_percent(questions: List[dict], submitted: Dict[str, str]) -> Dict[str, float]:
    """{topic: % correct} for multiple-choice style questions (answer = option text)."""
    right: Dict[str, int] = {}
    total: Dict[str, int] = {}
    for q in questions:
        t = q["topic"]
        total[t] = total.get(t, 0) + 1
        if submitted.get(q["id"]) == q["answer"]:
            right[t] = right.get(t, 0) + 1
    return {t: round(right.get(t, 0) / n * 100, 1) for t, n in total.items()}


def record_topic_scores(db: Session, user_id: int, skill_id: int, mastery: Dict[str, float],
                        source: str, session_id: Optional[int] = None) -> None:
    """Save one row per topic. `source` = "arena" or "reassessment"."""
    now = utc_now()
    for topic, score in (mastery or {}).items():
        db.add(models.TopicScore(
            user_id=user_id, skill_id=skill_id, topic=topic[:120], score=float(score),
            source=source, session_id=session_id, created_at=now,
        ))


def latest_topic_scores(db: Session, user_id: int, skill_id: int) -> Dict[str, float]:
    """{topic: newest score} for one user and course."""
    rows = (
        db.query(models.TopicScore)
        .filter(models.TopicScore.user_id == user_id, models.TopicScore.skill_id == skill_id)
        .order_by(models.TopicScore.created_at.asc(), models.TopicScore.id.asc())
        .all()
    )
    out: Dict[str, float] = {}
    for r in rows:
        out[r.topic] = r.score   # later rows overwrite earlier ones
    return out


def fallback_quiz(skill_name: str, topics: List[str]) -> List[dict]:
    """Reassessment questions from the hand-written bank when the AI is busy:
    the session's topics first, topped up from the rest of the bank."""
    bank = get_questions_for_skill(skill_name)
    if len(bank) < MIN_FALLBACK_QUESTIONS:
        return []
    wanted = {t.lower() for t in topics}
    on_topic = [q for q in bank if q["topic"].lower() in wanted]
    rest = [q for q in bank if q["topic"].lower() not in wanted]
    random.shuffle(on_topic)
    random.shuffle(rest)
    picked = (on_topic + rest)[:FALLBACK_QUIZ_SIZE]
    out = []
    for q in picked:
        q2 = copy.deepcopy(q)
        q2["id"] = f"r-{q['id']}"
        q2["type"] = "mcq" if q2.get("type") not in ("mcq", "output") else q2["type"]
        q2.setdefault("marks", 1)
        out.append(q2)
    return out


def apply_reassessment(db: Session, user_skill: Optional[models.UserSkill], score: float) -> dict:
    """Move the learner's course score gently towards the reassessment score
    (one quiz can't swing the level) and recompute the level. Badges are NOT
    changed here — they belong to the proctored Skill Arena only."""
    from ..routers.assessments import level_for_score   # same thresholds as the Arena

    # Only adjusts an existing Arena score: a short quiz never sets the first level.
    if user_skill is None or user_skill.role != "learning" or user_skill.latest_score is None:
        return {"updated": False}
    before = user_skill.latest_score
    level_before = user_skill.level
    after = round((1 - REASSESS_WEIGHT) * before + REASSESS_WEIGHT * score, 1)
    user_skill.latest_score = after
    user_skill.level = level_for_score(after)
    user_skill.level_num = score_to_level(after)
    return {
        "updated": True,
        "score_before": before, "score_after": after,
        "level_before": level_before, "level_after": user_skill.level,
    }
