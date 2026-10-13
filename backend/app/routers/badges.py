from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..services.badge_service import (
    TEACHER_BADGES,
    check_and_award_teacher_badges,
    get_user_earned_badges,
    award_badges_retroactively,
)

router = APIRouter(prefix="/badges", tags=["badges"])


@router.get("/definitions", response_model=List[schemas.TeacherBadgeDefinitionOut])
def get_badge_definitions():
    """
    Returns definitions for all 8 teacher badges.
    """
    return list(TEACHER_BADGES.values())


@router.get("/me", response_model=List[schemas.TeacherBadgeOut])
def get_my_teacher_badges(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns only the teacher badges actually earned by the current user.
    Evaluates computable thresholds and awards any newly earned badges.
    """
    return check_and_award_teacher_badges(db, current_user.id)


@router.get("/user/{user_id}", response_model=List[schemas.TeacherBadgeOut])
def get_user_teacher_badges(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns only the teacher badges actually earned by the specified user.
    Never returns unearned / locked placeholders.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return check_and_award_teacher_badges(db, user_id)


@router.post("/retroactive")
def trigger_retroactive_awards(
    db: Session = Depends(get_db),
):
    """
    Evaluates and awards computable badges retroactively across all existing users.
    """
    awarded = award_badges_retroactively(db)
    return {
        "status": "success",
        "message": f"Evaluated badges across {len(awarded)} qualified users.",
        "awarded": awarded,
    }
