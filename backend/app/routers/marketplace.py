from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from .. import models, schemas, auth
from ..database import get_db

from ..utils.levels import is_eligible_to_teach
from ..services.teacher_stats_service import get_teacher_public_stats_for_users

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.get("/search", response_model=List[schemas.MarketplaceUser], response_model_exclude_none=True)
def search_partners(
    q: Optional[str] = Query(None, description="Skill name or person name to search for"),
    role: Optional[str] = Query("All", description="All, 'I Want to Learn', 'I Can Teach'"),
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
    for u_id, data in users_map.items():
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

    # Convert to list and sort by match_score DESC
    results = [schemas.MarketplaceUser(**data) for data in users_map.values()]
    results.sort(key=lambda x: x.match_score, reverse=True)

    return results
