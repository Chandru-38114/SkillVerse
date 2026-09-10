from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/search", response_model=List[schemas.MarketplaceUser])
def search_teachers(
    skill: Optional[str] = Query(None, description="Skill name to search for"),
    min_badge: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Find users who teach the requested skill (or any skill if not specified)
    q = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .filter(models.UserSkill.role == "teaching")
        .filter(models.UserSkill.user_id != current_user.id)
        .filter(models.UserSkill.badge.isnot(None))
    )
    if skill:
        q = q.filter(models.Skill.name.ilike(f"%{skill}%"))

    # Get distinct user IDs that match the criteria
    matching_teacher_ids = {r.user_id for r in q.all()}

    if not matching_teacher_ids:
        return []

    # 2. Fetch all skills (both teaching and learning) for these users
    all_skills = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .join(models.User)
        .filter(models.UserSkill.user_id.in_(matching_teacher_ids))
        .all()
    )

    # 3. Group by user
    users_map = {}
    for us in all_skills:
        if us.user_id not in users_map:
            users_map[us.user_id] = {
                "user_id": us.user.id,
                "name": us.user.name,
                "college": us.user.college,
                "teaching_skills": [],
                "learning_skills": []
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

    return [schemas.MarketplaceUser(**data) for data in users_map.values()]