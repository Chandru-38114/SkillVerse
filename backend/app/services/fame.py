"""
Fame page: who are the best teachers and the most knowledgeable members?

Everything is plain, explainable arithmetic on data SkillVerse already stores.

Knowledge K (0-100), per course = the mean of the member's last 4 COUNTED weekly
    Skill Arena scores (only the first attempt of each week counts, so retrying
    can't raise it); a course with no weekly history uses its latest Arena score.
    K = the best course.
Teaching T (0-100) = 0.6 * rating + 0.4 * impact
    rating: Bayesian average (n*avg + 5*3.5)/(n+5) over TRUSTED reviews, scaled to 0-100.
            Trusted = one vote per reviewer (a reviewer's reviews are averaged) and
            reviews flagged as spam/suspicious are left out.
    impact: measured learner gains (services/tutor_ranking.impact_points, 50 = unknown).
Activity A (0-100) = 10 points per completed session, capped at 100, so piling up
    sessions stops helping after 10.
Fame score (Top Teachers) = 0.45*T + 0.35*K + 0.20*A
Rising Stars = biggest gain between the first and latest counted weekly score of a
    course within the last 8 weeks (needs 2+ counted weeks).

Review analysis: the AI (services/question_generator.analyze_teacher_reviews)
summarises the review texts; a keyword analysis is the fallback. It describes
the reviews only; it never changes the scores above.
"""
import datetime as dt
import hashlib
import json
import re
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .. import models
from ..utils.timezone import utc_now
from . import tutor_ranking as tr

W_TEACH, W_KNOW, W_ACTIVITY = 0.45, 0.35, 0.20
W_RATING_IN_T, W_IMPACT_IN_T = 0.6, 0.4
ACTIVITY_PER_SESSION, ACTIVITY_CAP = 10, 100
KNOWLEDGE_WEEKS = 4
RISING_WINDOW_WEEKS = 8
TOP_N = 10
AI_RETRY_AFTER = dt.timedelta(hours=6)

FORMULA = {
    "fame": "Fame = 45% Teaching + 35% Knowledge + 20% Activity",
    "teaching": "Teaching = 60% trusted rating (Bayesian, one vote per reviewer, spam removed) + 40% measured learner improvement",
    "knowledge": "Knowledge = best course's average of the last 4 counted weekly Skill Arena scores (first attempt each week only)",
    "activity": "Activity = 10 points per completed session, capped at 100",
    "rising": "Rising Stars = biggest improvement in counted weekly scores over the last 8 weeks",
}


# ---------------------------------------------------------------------------
# Reviews: rules that catch spam, and one vote per reviewer
# ---------------------------------------------------------------------------
_URL = re.compile(r"https?://|www\.|\.com\b", re.I)


def teaching_reviews(db: Session, user_ids: Iterable[int]) -> Dict[int, List[models.Review]]:
    """Reviews each user received AS A TUTOR (same rule as teacher_stats_service)."""
    user_ids = list(set(user_ids))
    if not user_ids:
        return {}
    rows = (
        db.query(models.Review)
        .outerjoin(models.Session, models.Session.id == models.Review.session_id)
        .outerjoin(models.ConnectionRequest, models.ConnectionRequest.id == models.Review.request_id)
        .filter(
            models.Review.reviewee_id.in_(user_ids),
            or_(
                models.Session.tutor_id == models.Review.reviewee_id,
                and_(models.Review.session_id.is_(None), models.ConnectionRequest.to_user_id == models.Review.reviewee_id),
            ),
        )
        .order_by(models.Review.created_at.asc(), models.Review.id.asc())
        .all()
    )
    out: Dict[int, List[models.Review]] = defaultdict(list)
    for r in rows:
        out[r.reviewee_id].append(r)
    return out


def rule_flags(reviews: List[models.Review]) -> Dict[int, str]:
    """{review_id: reason} for reviews that look like spam or rating manipulation."""
    flags: Dict[int, str] = {}
    seen_text = set()
    per_reviewer_day = defaultdict(int)
    for r in reviews:
        text = (r.comment or "").strip()
        day = r.created_at.date() if r.created_at else None
        per_reviewer_day[(r.reviewer_id, day)] += 1
        if _URL.search(text):
            flags[r.id] = "contains a link"
        elif text and (r.reviewer_id, text.lower()) in seen_text:
            flags[r.id] = "same text posted again"
        elif per_reviewer_day[(r.reviewer_id, day)] > 3:
            flags[r.id] = "too many reviews from one person in a day"
        elif text and not re.search(r"[A-Za-z]{2,}", text):
            flags[r.id] = "no real words"
        seen_text.add((r.reviewer_id, text.lower()))
    return flags


def trusted_rating(reviews: List[models.Review], flagged: Iterable[int]) -> dict:
    """One vote per reviewer (their reviews averaged), flagged reviews left out."""
    flagged = set(flagged)
    by_reviewer = defaultdict(list)
    for r in reviews:
        if r.id not in flagged:
            by_reviewer[r.reviewer_id].append(r.rating)
    votes = [sum(v) / len(v) for v in by_reviewer.values()]
    n = len(votes)
    avg = round(sum(votes) / n, 2) if n else None
    return {"count": n, "average": avg, "bayes": round(tr.bayes_rating(avg, n), 2), "flagged": len(flagged)}


# ---------------------------------------------------------------------------
# Keyword analysis (fallback when the AI is unavailable)
# ---------------------------------------------------------------------------
QUALITY_WORDS = {
    "clarity": ("clear", "explain", "easy to understand", "simple", "understandable", "step by step"),
    "knowledge": ("knowledge", "knows", "expert", "depth", "deep", "concept", "experienced"),
    "communication": ("communicat", "friendly", "listen", "responsive", "polite", "interactive"),
    "helpfulness": ("help", "support", "doubt", "example", "practice", "resource", "useful"),
    "patience": ("patient", "patience", "calm", "repeat", "again", "kind"),
}
QUALITY_LABEL = {
    "clarity": "Clear explanations", "knowledge": "Strong subject knowledge",
    "communication": "Good communication", "helpfulness": "Very helpful", "patience": "Patient with learners",
}
ISSUE_WORDS = {
    "too fast": "Slow down the pace", "fast": "Slow down the pace", "rushed": "Slow down the pace",
    "late": "Join sessions on time", "confus": "Explain step by step", "unprepared": "Prepare examples in advance",
    "boring": "Make sessions more interactive", "audio": "Fix audio quality",
}


def keyword_insight(reviews: List[models.Review], flagged: Dict[int, str]) -> Optional[dict]:
    usable = [r for r in reviews if r.id not in flagged]
    if not usable:
        return None
    mentions = defaultdict(list)
    issues: List[str] = []
    for r in usable:
        text = (r.comment or "").lower()
        for q, words in QUALITY_WORDS.items():
            if any(w in text for w in words):
                mentions[q].append(r.rating)
        for w, tip in ISSUE_WORDS.items():
            if w in text and tip not in issues and r.rating <= 3:
                issues.append(tip)
    ranked = sorted(mentions, key=lambda q: (-len(mentions[q]), q))
    strengths = [QUALITY_LABEL[q] for q in ranked if sum(mentions[q]) / len(mentions[q]) >= 3.5][:3]
    avg = sum(r.rating for r in usable) / len(usable)
    if strengths:
        summary = f"Rated {avg:.1f}★ across {len(usable)} reviews. Learners most often mention: {', '.join(s.lower() for s in strengths)}."
    else:
        summary = f"Rated {avg:.1f}★ across {len(usable)} reviews."
    return {
        "summary": summary,
        "strengths": strengths,
        "improvements": issues[:2],
        "qualities": {q: (round(sum(v) / len(v)) if v else None) for q, v in ((q, mentions.get(q, [])) for q in QUALITY_WORDS)},
        "flagged": list(flagged),
    }


def _review_key(reviews: List[models.Review]) -> str:
    raw = "|".join(f"{r.id}:{r.rating}:{(r.comment or '').strip()}" for r in reviews)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_insight(db: Session, user_id: int, reviews: Optional[List[models.Review]] = None,
                use_ai: bool = False) -> Optional[dict]:
    """Cached AI insight when it matches the current reviews; otherwise (and when
    use_ai is False) a live keyword insight. With use_ai=True the AI is called
    (at most every 6 h per teacher if it keeps failing) and the result cached."""
    if reviews is None:
        reviews = teaching_reviews(db, [user_id]).get(user_id, [])
    if not reviews:
        return None
    flags = rule_flags(reviews)
    key = _review_key(reviews)
    cached = db.query(models.ReviewInsight).filter_by(user_id=user_id).first()
    if cached and cached.review_key == key and (cached.source == "ai" or not use_ai
                                               or utc_now() - _aware(cached.updated_at) < AI_RETRY_AFTER):
        data = json.loads(cached.data)
        data["source"] = cached.source
        return data

    data, source = None, "keywords"
    if use_ai:
        from .question_generator import analyze_teacher_reviews   # the only module that calls the AI
        data = analyze_teacher_reviews([
            {"id": r.id, "rating": r.rating, "comment": r.comment or ""} for r in reviews if r.id not in flags
        ])
        if data:
            source = "ai"
            data["flagged"] = sorted(set(data["flagged"]) | set(flags))
    if data is None:
        data = keyword_insight(reviews, flags)
        if data is None:
            return None
    if use_ai:   # only store results of an AI attempt; plain page views stay read-only
        if cached:
            cached.review_key, cached.data, cached.source, cached.updated_at = key, json.dumps(data), source, utc_now()
        else:
            db.add(models.ReviewInsight(user_id=user_id, review_key=key, data=json.dumps(data), source=source))
        db.commit()
    data["source"] = source
    return data


def _aware(t: dt.datetime) -> dt.datetime:
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


# ---------------------------------------------------------------------------
# Weekly assessment: knowledge, streaks and badges
# ---------------------------------------------------------------------------
WEEKLY_BADGES = [
    ("weekly_first", "First Weekly Check", "🗓️", "Took a counted weekly Skill Arena"),
    ("streak_3", "3-Week Streak", "🔥", "Counted weekly assessments 3 weeks in a row"),
    ("streak_6", "6-Week Streak", "🏅", "Counted weekly assessments 6 weeks in a row"),
    ("improver", "Improver", "📈", "Beat your previous weekly score in a course by 10+ points"),
    ("big_leap", "Big Leap", "🚀", "Beat your previous weekly score in a course by 25+ points"),
]


def _monday(d: dt.date) -> dt.date:
    return d - dt.timedelta(days=d.weekday())


def weekly_history(db: Session, user_ids: Iterable[int]) -> Dict[int, Dict[int, List[models.WeeklyAttempt]]]:
    """{user_id: {skill_id: [counted attempts, oldest first]}}"""
    user_ids = list(set(user_ids))
    out: Dict[int, Dict[int, list]] = defaultdict(lambda: defaultdict(list))
    if not user_ids:
        return out
    for a in (db.query(models.WeeklyAttempt)
              .filter(models.WeeklyAttempt.user_id.in_(user_ids), models.WeeklyAttempt.counted.is_(True))
              .order_by(models.WeeklyAttempt.week_start.asc(), models.WeeklyAttempt.id.asc())
              .all()):
        out[a.user_id][a.skill_id].append(a)
    return out


def weekly_status(history: Dict[int, list], today: Optional[dt.date] = None) -> dict:
    """Streaks and badges from one user's counted weekly attempts."""
    today = today or utc_now().date()
    weeks = sorted({a.week_start for atts in history.values() for a in atts})
    best = cur = 0
    prev = None
    for w in weeks:
        cur = cur + 1 if prev is not None and (w - prev).days == 7 else 1
        best = max(best, cur)
        prev = w
    this_week = _monday(today)
    current = cur if weeks and (this_week - weeks[-1]).days in (0, 7) else 0
    best_jump = 0.0
    for atts in history.values():
        for a, b in zip(atts, atts[1:]):
            best_jump = max(best_jump, b.score - a.score)
    earned = {
        "weekly_first": bool(weeks), "streak_3": best >= 3, "streak_6": best >= 6,
        "improver": best_jump >= 10, "big_leap": best_jump >= 25,
    }
    return {
        "current_streak": current,
        "best_streak": best,
        "weeks_taken": len(weeks),
        "this_week_done": bool(weeks) and weeks[-1] == this_week,
        "badges": [{"id": i, "name": n, "icon": ic, "description": d} for i, n, ic, d in WEEKLY_BADGES if earned[i]],
    }


def course_knowledge(us: models.UserSkill, attempts: List[models.WeeklyAttempt]) -> Optional[float]:
    if attempts:
        last = attempts[-KNOWLEDGE_WEEKS:]
        return round(sum(a.score for a in last) / len(last), 1)
    return round(us.latest_score, 1) if us.latest_score is not None else None


def rising_gain(attempts: List[models.WeeklyAttempt], today: dt.date) -> Optional[float]:
    since = _monday(today) - dt.timedelta(weeks=RISING_WINDOW_WEEKS)
    recent = [a for a in attempts if a.week_start >= since]
    if len(recent) < 2:
        return None
    return round(recent[-1].score - recent[0].score, 1)


# ---------------------------------------------------------------------------
# The Fame board
# ---------------------------------------------------------------------------
def build_fame(db: Session, today: Optional[dt.date] = None) -> dict:
    today = today or utc_now().date()
    skills = (db.query(models.UserSkill)
              .filter(models.UserSkill.level_num > 0)
              .all())
    users_courses: Dict[int, List[models.UserSkill]] = defaultdict(list)
    for us in skills:
        users_courses[us.user_id].append(us)
    user_ids = list(users_courses)
    if not user_ids:
        return {"top_teachers": [], "most_knowledgeable": [], "rising_stars": [], "formula": FORMULA}

    users = {u.id: u for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all()}
    history = weekly_history(db, user_ids)
    reviews = teaching_reviews(db, user_ids)
    impacts = tr.teaching_impact_for_users(db, user_ids)

    taught = defaultdict(lambda: {"sessions": 0, "students": set()})
    for s in (db.query(models.Session.tutor_id, models.Session.learner_id)
              .filter(models.Session.tutor_id.in_(user_ids), models.Session.status == "completed").all()):
        taught[s.tutor_id]["sessions"] += 1
        taught[s.tutor_id]["students"].add(s.learner_id)

    certs = defaultdict(list)
    for c in db.query(models.Certificate).filter(models.Certificate.user_id.in_(user_ids)).all():
        certs[c.user_id].append(c.skill.name if c.skill else "")
    badge_counts = defaultdict(int)
    for b in db.query(models.UserBadge.user_id).filter(models.UserBadge.user_id.in_(user_ids)).all():
        badge_counts[b.user_id] += 1

    cards = {}
    for uid, courses in users_courses.items():
        u = users.get(uid)
        if not u:
            continue
        hist = history.get(uid, {})
        course_rows, best_k, best_gain, gain_course = [], None, None, None
        for us in courses:
            k = course_knowledge(us, hist.get(us.skill_id, []))
            name = us.skill.name if us.skill else ""
            course_rows.append({"name": name, "role": us.role, "level": us.level, "level_num": us.level_num,
                                "badge": us.badge, "score": k})
            if k is not None and (best_k is None or k > best_k):
                best_k = k
            g = rising_gain(hist.get(us.skill_id, []), today)
            if g is not None and (best_gain is None or g > best_gain):
                best_gain, gain_course = g, name
        revs = reviews.get(uid, [])
        flags = rule_flags(revs)
        rating = trusted_rating(revs, flags)
        t_info = taught.get(uid, {"sessions": 0, "students": set()})
        teaching = None
        if t_info["sessions"]:
            teaching = round(W_RATING_IN_T * rating["bayes"] / 5 * 100 + W_IMPACT_IN_T * tr.impact_points(impacts.get(uid)), 1)
        activity = min(ACTIVITY_CAP, ACTIVITY_PER_SESSION * t_info["sessions"])
        fame = round(W_TEACH * teaching + W_KNOW * (best_k or 0) + W_ACTIVITY * activity, 1) if teaching is not None else None
        impact = impacts.get(uid)
        weekly = weekly_status(hist, today)
        reasons = []
        if rating["count"] and rating["average"] is not None and rating["average"] >= 4:
            reasons.append(f"{rating['average']:.1f}★ from {rating['count']} learner{'s' if rating['count'] != 1 else ''}")
        if impact and impact.get("avg_gain") is not None and impact["avg_gain"] > 0:
            reasons.append(f"Learners improve +{impact['avg_gain']} pts per session")
        if best_k is not None and best_k >= 75:
            reasons.append(f"Verified {round(best_k)}% knowledge")
        if weekly["current_streak"] >= 2:
            reasons.append(f"{weekly['current_streak']}-week assessment streak")
        cards[uid] = {
            "user_id": uid,
            "name": u.name,
            "avatar_url": u.profile_picture_url,
            "college": u.college or "",
            "bio": (u.bio or "")[:200],
            "courses": sorted(course_rows, key=lambda c: -(c["score"] or 0)),
            "knowledge_score": best_k,
            "teaching_score": teaching,
            "activity_score": activity,
            "fame_score": fame,
            "average_rating": rating["average"],
            "review_count": rating["count"],
            "flagged_reviews": rating["flagged"],
            "sessions_taught": t_info["sessions"],
            "students_taught": len(t_info["students"]),
            "learner_gain": impact.get("avg_gain") if impact else None,
            "certificates": [c for c in certs.get(uid, []) if c],
            "badges_count": badge_counts.get(uid, 0) + len(weekly["badges"]),
            "weekly": weekly,
            "rising_gain": best_gain,
            "rising_course": gain_course,
            "reasons": reasons[:3],
            "contribution": _contribution(t_info, certs.get(uid, []), weekly),
            "insight": None,
        }

    top_teachers = sorted((c for c in cards.values() if c["fame_score"] is not None),
                          key=lambda c: (-c["fame_score"], -c["review_count"], c["user_id"]))[:TOP_N]
    knowledgeable = sorted((c for c in cards.values() if c["knowledge_score"] is not None),
                           key=lambda c: (-c["knowledge_score"], -c["weekly"]["weeks_taken"], c["user_id"]))[:TOP_N]
    rising = sorted((c for c in cards.values() if c["rising_gain"] is not None and c["rising_gain"] > 0),
                    key=lambda c: (-c["rising_gain"], c["user_id"]))[:TOP_N]

    for c in top_teachers:
        c["insight"] = get_insight(db, c["user_id"], reviews.get(c["user_id"], []), use_ai=False)
    return {"top_teachers": top_teachers, "most_knowledgeable": knowledgeable, "rising_stars": rising, "formula": FORMULA}


def _contribution(t_info: dict, certs: list, weekly: dict) -> str:
    parts = []
    if t_info["sessions"]:
        n, s = t_info["sessions"], len(t_info["students"])
        parts.append(f"Taught {n} session{'s' if n != 1 else ''} to {s} learner{'s' if s != 1 else ''}")
    if certs:
        parts.append(f"{len(certs)} course certificate{'s' if len(certs) != 1 else ''}")
    if weekly["weeks_taken"]:
        parts.append(f"{weekly['weeks_taken']} weekly assessment{'s' if weekly['weeks_taken'] != 1 else ''}")
    return " · ".join(parts) or "New member of SkillVerse"
