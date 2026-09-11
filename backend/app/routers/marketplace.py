from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.get("/search", response_model=List[schemas.MarketplaceUser])
def search_partners(
    q: Optional[str] = Query(None, description="Skill name or person name to search for"),
    role: Optional[str] = Query("All", description="All, 'I Want to Learn', 'I Can Teach'"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Fetch current user's skills for recommendation logic
    my_skills = db.query(models.UserSkill).join(models.Skill).filter(models.UserSkill.user_id == current_user.id).all()
    my_learning = {s.skill.name.lower() for s in my_skills if s.role == "learning"}
    my_teaching = {s.skill.name.lower() for s in my_skills if s.role == "teaching"}

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
                "teaching_skills": [],
                "learning_skills": [],
                "match_score": 0,
                "match_context": None
            }
        
        skill_info = schemas.SkillBadgeInfo(
            skill_name=us.skill.name,
            level=us.level,
            badge=us.badge,
            score=us.latest_score
        )
        
        if us.role == "teaching":
            users_map[us.user_id]["teaching_skills"].append(skill_info)
        else:
            users_map[us.user_id]["learning_skills"].append(skill_info)

    # Calculate deterministic matching score
    for u_id, data in users_map.items():
        their_teaching = {s.skill_name.lower() for s in data["teaching_skills"]}
        their_learning = {s.skill_name.lower() for s in data["learning_skills"]}
        
        # Intersection matches
        i_can_learn_from_them = my_learning.intersection(their_teaching)
        i_can_teach_them = my_teaching.intersection(their_learning)
        
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

    # Convert to list and sort by match_score DESC
    results = [schemas.MarketplaceUser(**data) for data in users_map.values()]
    results.sort(key=lambda x: x.match_score, reverse=True)

    return results
