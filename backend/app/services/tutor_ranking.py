"""
Features 2-4: measured teaching impact, knowledge-gap recommendations and
tutor ranking. Everything here is plain arithmetic on data we already store.

Teaching impact
    After every session the learner takes a reassessment, which saves one
    TopicScore per topic. The "gain" for a topic is that score minus the
    learner's previous score on the same topic (from an earlier Arena attempt
    or reassessment). A tutor's impact is the average gain per session.
    It's shown only after 3+ measured sessions, and ranked with a "shrunk"
    mean  (n * mean_gain) / (n + 3)  so 1 lucky session can't top the list.

Tutor score (0-100) used for ranking
    0.5 * strength   (their Arena score on the course, or on your weak topics)
    0.3 * impact     (50 = unknown/neutral, +2.5 points per point of shrunk gain)
    0.2 * rating     (Bayesian: (n*avg + 5*3.5) / (n + 5), so 1 five-star review
                      isn't better than 40 reviews averaging 4.8)
"""
from typing import Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from .. import models

IMPACT_MIN_SESSIONS = 3
IMPACT_SHRINK = 3
RATING_PRIOR_N = 5
RATING_PRIOR_MEAN = 3.5
WEAK_TOPIC = 60       # below this a topic is "weak"
STRONG_TOPIC = 75     # a tutor at or above this is "strong" on a topic
W_STRENGTH, W_IMPACT, W_RATING = 0.5, 0.3, 0.2


def teaching_impact_for_users(db: Session, tutor_ids: Iterable[int]) -> Dict[int, dict]:
    """{tutor_id: {"sessions_measured", "avg_gain", "impact_rank"}} for tutors
    with at least one measured session. avg_gain is None until 3 sessions."""
    tutor_ids = list(set(tutor_ids))
    if not tutor_ids:
        return {}
    rows = (
        db.query(models.TopicScore, models.Session.tutor_id)
        .join(models.Session, models.Session.id == models.TopicScore.session_id)
        .filter(models.TopicScore.source == "reassessment", models.Session.tutor_id.in_(tutor_ids))
        .all()
    )
    if not rows:
        return {}

    # Earlier scores of the same learners/courses, to compare against.
    pairs = {(r.user_id, r.skill_id) for r, _ in rows}
    history: Dict[tuple, List[models.TopicScore]] = {}
    for h in (
        db.query(models.TopicScore)
        .filter(models.TopicScore.user_id.in_({p[0] for p in pairs}),
                models.TopicScore.skill_id.in_({p[1] for p in pairs}))
        .order_by(models.TopicScore.created_at.asc(), models.TopicScore.id.asc())
        .all()
    ):
        history.setdefault((h.user_id, h.skill_id, h.topic), []).append(h)

    per_session: Dict[tuple, List[float]] = {}   # (tutor, session) -> topic gains
    for r, tutor_id in rows:
        earlier = [h for h in history.get((r.user_id, r.skill_id, r.topic), [])
                   if (h.created_at, h.id) < (r.created_at, r.id)]
        if earlier:
            per_session.setdefault((tutor_id, r.session_id), []).append(r.score - earlier[-1].score)

    gains: Dict[int, List[float]] = {}
    for (tutor_id, _), g in per_session.items():
        gains.setdefault(tutor_id, []).append(sum(g) / len(g))

    out = {}
    for tutor_id, g in gains.items():
        n, mean = len(g), sum(g) / len(g)
        out[tutor_id] = {
            "sessions_measured": n,
            "avg_gain": round(mean, 1) if n >= IMPACT_MIN_SESSIONS else None,
            "impact_rank": round(n * mean / (n + IMPACT_SHRINK), 2),
        }
    return out


def bayes_rating(avg: Optional[float], count: Optional[int]) -> float:
    n = count or 0
    if not n or avg is None:
        return RATING_PRIOR_MEAN
    return (n * avg + RATING_PRIOR_N * RATING_PRIOR_MEAN) / (n + RATING_PRIOR_N)


def impact_points(impact: Optional[dict]) -> float:
    """0-100, 50 = no data. Only counts once there are enough sessions."""
    if not impact or impact["avg_gain"] is None:
        return 50.0
    return max(0.0, min(100.0, 50 + 2.5 * impact["impact_rank"]))


def tutor_score(strength: Optional[float], impact: Optional[dict], stats: Optional[dict]) -> float:
    rating = bayes_rating((stats or {}).get("average_rating"), (stats or {}).get("review_count"))
    return round(W_STRENGTH * (strength or 0) + W_IMPACT * impact_points(impact) + W_RATING * rating / 5 * 100, 1)


def rank_reasons(strength: Optional[float], impact: Optional[dict], stats: Optional[dict], course: Optional[str]) -> List[str]:
    """Short, honest chips explaining why someone ranks high."""
    reasons = []
    if strength is not None and strength >= STRONG_TOPIC and course:
        reasons.append(f"Scored {round(strength)}% in {course}")
    if impact and impact["avg_gain"] is not None and impact["avg_gain"] > 0:
        reasons.append(f"Learners improve +{impact['avg_gain']} pts per session")
    if stats:
        if stats.get("review_count") and stats.get("average_rating") is not None and stats["average_rating"] >= 4:
            reasons.append(f"Rated {stats['average_rating']}★ ({stats['review_count']})")
        if stats.get("sessions_taught", 0) >= 5:
            reasons.append(f"{stats['sessions_taught']} sessions taught")
    return reasons[:3]
