from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/search", response_model=List[schemas.MarketplaceTeacher])
def search_teachers(
    skill: Optional[str] = Query(None, description="Skill name to search for"),
    min_badge: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.UserSkill)
        .join(models.Skill)
        .join(models.User)
        .filter(models.UserSkill.role == "teaching")
        .filter(models.UserSkill.user_id != current_user.id)
        .filter(models.UserSkill.badge.isnot(None))
    )
    if skill:
        q = q.filter(models.Skill.name.ilike(f"%{skill}%"))

    results = q.all()
    return [
        schemas.MarketplaceTeacher(
            user_id=r.user.id, name=r.user.name, college=r.user.college,
            skill_name=r.skill.name, level=r.level, badge=r.badge, score=r.latest_score,
        )
        for r in results
    ]