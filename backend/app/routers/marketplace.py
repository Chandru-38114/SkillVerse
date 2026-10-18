"""
Marketplace: find people to learn from (and teach).

/search       everyone matching a name/course, ranked by (match tier, tutor score)
/recommended  tutors who are strong in YOUR weak topics (from your topic scores)
Ranking maths lives in services/tutor_ranking.py.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from .. import models, schemas, auth
from ..database import get_db

from ..utils.levels import is_eligible_to_teach
from ..services.teacher_stats_service import get_teacher_public_stats_for_users
from ..services.topic_scores import latest_topic_scores
from ..services import tutor_ranking as tr

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.get("/search", response_model=List[schemas.MarketplaceUser], response_model_exclude_none=True)
def search_partners(
    q: Optional[str] = Query(None, description="Skill name or person name to search for"),
    role: Optional[str] = Query("All", description="All, 'I Want to Learn', 'I Can Teach'"),
    sort: str = Query("best", description="best, rating, sessions or impact"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Fetch current user's skills for recommendation logic
    my_skills = db.query(models.UserSkill).join(models.Skill).filter(models.UserSkill.user_id == current_user.id).all()
    my_learning = {s.skill.name.lower(): (s.level_num if s.level_num is not None else 0) for s in my_skills if s.role == "learning"}
    my_teaching = {s.skill.name.lower(): (s.level_num if s.level_num is not None else 0) for s in my_skills if s.role == "teaching"}

    # 2. Build the query
    query = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .join(models.User)
        .filter(models.UserSkill.user_id != current_user.id)
    )
    
    if role == "I Want to Learn":
        # We are looking for people who can teach
        query = query.filter(models.UserSkill.role == "teaching")
    elif role == "I Can Teach":
        # We are looking for people who want to learn
        query = query.filter(models.UserSkill.role == "learning")
        
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                models.User.name.ilike(search_term),
                models.Skill.name.ilike(search_term)
            )
        )
        
    matching_user_ids = {r.user_id for r in query.all()}
    
    if not matching_user_ids:
        return []
        
    # 3. Fetch all skills (both teaching and learning) for matched users
    all_skills = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .join(models.User)
        .filter(models.UserSkill.user_id.in_(matching_user_ids))
        .all()
    )
    
    # 4. Group by user and calculate match context
    users_map = {}
    for us in all_skills:
        if us.user_id not in users_map:
            users_map[us.user_id] = {
                "user_id": us.user.id,
                "name": us.user.name,
                "college": us.user.college,
                "bio": us.user.bio or None,
                "profile_picture_url": getattr(us.user, "profile_picture_url", None),
                "teaching_skills": [],
                "learning_skills": [],
                "match_score": 0,
                "match_context": None
            }
        
        lvl_num = us.level_num if us.level_num is not None else 0
        skill_info = schemas.SkillBadgeInfo(
            skill_name=us.skill.name,
            level=us.level,
            badge=us.badge,
            score=us.latest_score,
            level_num=lvl_num
        )
        
        if us.role == "teaching":
            users_map[us.user_id]["teaching_skills"].append(skill_info)
        else:
            users_map[us.user_id]["learning_skills"].append(skill_info)

    # Calculate deterministic matching score with eligibility rule
    for data in users_map.values():
        their_teaching_map = {s.skill_name.lower(): (s.level_num or 0) for s in data["teaching_skills"]}
        their_learning_map = {s.skill_name.lower(): (s.level_num or 0) for s in data["learning_skills"]}

        # Check eligibility:
        # i_can_learn_from_them: they teach, I learn
        # eligible if their_level >= my_level + 2 AND their_level >= 2
        i_can_learn_from_them = {
            s_name for s_name, their_lvl in their_teaching_map.items()
            if s_name in my_learning and is_eligible_to_teach(their_lvl, my_learning[s_name])
        }

        # i_can_teach_them: I teach, they learn
        # eligible if my_level >= their_level + 2 AND my_level >= 2
        i_can_teach_them = {
            s_name for s_name, their_lvl in their_learning_map.items()
            if s_name in my_teaching and is_eligible_to_teach(my_teaching[s_name], their_lvl)
        }
        
        # Strength for ranking: their best Arena score on a course you can learn
        # from them (otherwise on any course they teach).
        teach_scores = {s.skill_name.lower(): (s.score, s.skill_name) for s in data["teaching_skills"] if s.score is not None}
        relevant = [teach_scores[n] for n in i_can_learn_from_them if n in teach_scores] or list(teach_scores.values())
        best = max(relevant, default=None)
        data["_strength"], data["_course"] = (best if best else (None, None))
        data["_tier"] = 3 if (i_can_learn_from_them and i_can_teach_them) else 2 if i_can_learn_from_them else 1 if i_can_teach_them else 0

        if i_can_learn_from_them and i_can_teach_them:
            data["match_score"] = 100 + len(i_can_learn_from_them) + len(i_can_teach_them)
            data["match_context"] = "Perfect skill exchange"
        elif i_can_learn_from_them:
            data["match_score"] = 50 + len(i_can_learn_from_them)
            # Find a capitalized skill name for display
            skill_display = next((s.skill_name for s in data["teaching_skills"] if s.skill_name.lower() in i_can_learn_from_them), list(i_can_learn_from_them)[0].title())
            data["match_context"] = f"You can learn {skill_display} from {data['name'].split()[0]}"
        elif i_can_teach_them:
            data["match_score"] = 50 + len(i_can_teach_them)
            skill_display = next((s.skill_name for s in data["learning_skills"] if s.skill_name.lower() in i_can_teach_them), list(i_can_teach_them)[0].title())
            data["match_context"] = f"You can teach {skill_display} to {data['name'].split()[0]}"
        else:
            data["match_score"] = len(data["teaching_skills"]) + len(data["learning_skills"]) # baseline activity

    # 5. Teacher stats public summary for matched users (1 grouped query for sessions, 1 for reviews)
    teacher_summaries = get_teacher_public_stats_for_users(db, list(matching_user_ids))
    impacts = tr.teaching_impact_for_users(db, matching_user_ids)
    for u_id, u_data in users_map.items():
        stats, impact = teacher_summaries.get(u_id), impacts.get(u_id)
        u_data["teaching_impact"] = schemas.TeachingImpact(**impact) if impact else None
        if u_data["teaching_skills"]:
            u_data["tutor_score"] = tr.tutor_score(u_data["_strength"], impact, stats)
            u_data["rank_reasons"] = tr.rank_reasons(u_data["_strength"], impact, stats, u_data["_course"])
    for u_id, u_data in users_map.items():
        if u_id in teacher_summaries:
            stats = teacher_summaries[u_id]
            u_data["teacher_stats"] = schemas.TeacherPublicSummary(**stats)
            u_data["average_rating"] = stats["average_rating"]
            u_data["review_count"] = stats["review_count"]
            u_data["sessions_taught"] = stats["sessions_taught"]
            u_data["teaching_since"] = stats["teaching_since"]
        else:
            u_data["teacher_stats"] = None
            u_data["average_rating"] = None
            u_data["review_count"] = None
            u_data["sessions_taught"] = None
            u_data["teaching_since"] = None

    # 6. Bulk query connection requests between current_user and all matched users
    reqs = (
        db.query(models.ConnectionRequest, models.Skill)
        .join(models.Skill, models.ConnectionRequest.skill_id == models.Skill.id)
        .filter(
            or_(
                and_(models.ConnectionRequest.from_user_id == current_user.id, models.ConnectionRequest.to_user_id.in_(matching_user_ids)),
                and_(models.ConnectionRequest.from_user_id.in_(matching_user_ids), models.ConnectionRequest.to_user_id == current_user.id)
            )
        )
        .order_by(desc(models.ConnectionRequest.created_at))
        .all()
    )
    
    for req, skill in reqs:
        other_id = req.to_user_id if req.from_user_id == current_user.id else req.from_user_id
        if other_id in users_map:
            if "connection_statuses" not in users_map[other_id]:
                users_map[other_id]["connection_statuses"] = {}
            # Because of ORDER BY desc, we only take the most recent request per skill
            if skill.name not in users_map[other_id]["connection_statuses"]:
                users_map[other_id]["connection_statuses"][skill.name] = {
                    "status": req.status,
                    "request_id": req.id
                }

    # 7. Sort. "best" = people you can actually swap/learn with first, then by tutor score.
    tiers = {u_id: d.pop("_tier") for u_id, d in users_map.items()}
    for d in users_map.values():
        d.pop("_strength", None)
        d.pop("_course", None)
    results = [schemas.MarketplaceUser(**data) for data in users_map.values()]
    keys = {
        "rating": lambda x: (tr.bayes_rating(x.average_rating, x.review_count) if x.review_count else 0, x.review_count or 0),
        "sessions": lambda x: (x.sessions_taught or 0,),
        "impact": lambda x: (x.teaching_impact.impact_rank if x.teaching_impact and x.teaching_impact.avg_gain is not None else -999,),
    }
    key = keys.get(sort, lambda x: (tiers[x.user_id], x.tutor_score or 0, x.match_score))
    results.sort(key=key, reverse=True)

    return results


@router.get("/recommended", response_model=List[schemas.RecommendedTutor])
def recommended_tutors(
    limit: int = Query(6, ge=1, le=12),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Knowledge-gap recommendations: for each course you're learning, your
    weak topics (latest topic score below 60) are matched with tutors who are
    strong (75+) in them and allowed to teach you (2+ levels above)."""
    mine = (
        db.query(models.UserSkill)
        .filter(models.UserSkill.user_id == current_user.id, models.UserSkill.role == "learning")
        .all()
    )
    picks: dict = {}   # tutor_id -> best RecommendedTutor data
    for course in mine:
        weak = sorted(t for t, v in latest_topic_scores(db, current_user.id, course.skill_id).items() if v < tr.WEAK_TOPIC)
        if not weak:
            continue
        my_level = course.level_num or 0
        tutors = (
            db.query(models.UserSkill)
            .filter(models.UserSkill.skill_id == course.skill_id, models.UserSkill.role == "teaching",
                    models.UserSkill.user_id != current_user.id)
            .all()
        )
        tutors = [t for t in tutors if is_eligible_to_teach(t.level_num or 0, my_level)]
        if not tutors:
            continue
        ids = [t.user_id for t in tutors]
        stats = get_teacher_public_stats_for_users(db, ids)
        impacts = tr.teaching_impact_for_users(db, ids)
        for t in tutors:
            theirs = latest_topic_scores(db, t.user_id, course.skill_id)
            strong = [w for w in weak if theirs.get(w, -1) >= tr.STRONG_TOPIC]
            if theirs:
                if not strong:
                    continue     # we know their topics and they're not strong where you're weak
                # Their average on your weak topics, a bit higher if they cover more of them.
                avg_strong = sum(theirs[w] for w in strong) / len(strong)
                strength = avg_strong * (0.7 + 0.3 * len(strong) / len(weak))
            else:
                strength = t.latest_score   # older tutors: no topic history yet, use the overall score
                if strength is None or strength < tr.STRONG_TOPIC:
                    continue
            score = tr.tutor_score(min(strength, 100), impacts.get(t.user_id), stats.get(t.user_id))
            if t.user_id in picks and picks[t.user_id]["tutor_score"] >= score:
                continue
            reasons = ([f"Strong in {', '.join(strong[:2])}"] if strong else []) + \
                tr.rank_reasons(None, impacts.get(t.user_id), stats.get(t.user_id), None)
            picks[t.user_id] = {
                "user_id": t.user_id, "name": t.user.name,
                "profile_picture_url": getattr(t.user, "profile_picture_url", None),
                "skill_name": course.skill.name, "weak_topics": weak, "strong_topics": strong,
                "tutor_score": score, "rank_reasons": reasons[:3], "_skill_id": course.skill_id,
            }

    if not picks:
        return []
    # Show an existing request so the button can say "Requested" instead of sending a duplicate.
    reqs = (
        db.query(models.ConnectionRequest)
        .filter(models.ConnectionRequest.from_user_id == current_user.id,
                models.ConnectionRequest.to_user_id.in_(picks.keys()))
        .order_by(desc(models.ConnectionRequest.created_at))
        .all()
    )
    for r in reqs:
        p = picks.get(r.to_user_id)
        if p and r.skill_id == p["_skill_id"] and "connection_status" not in p:
            p["connection_status"] = r.status
    ranked = sorted(picks.values(), key=lambda p: p["tutor_score"], reverse=True)[:limit]
    for p in ranked:
        p.pop("_skill_id")
    return [schemas.RecommendedTutor(**p) for p in ranked]
