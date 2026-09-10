from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func

from .. import models, auth, schemas
from ..database import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/gamification", tags=["gamification"])

class LeaderboardUser(BaseModel):
    rank: int
    user_id: int
    name: str
    profile_picture_url: str | None
    points: int

class Achievement(BaseModel):
    id: str
    title: str
    description: str
    earned: bool
    earned_at: str | None = None
    icon: str

class GamificationSummary(BaseModel):
    total_points: int
    current_rank: int
    achievements: list[Achievement]
    next_milestone_points: int | None
    next_milestone_title: str | None

@router.get("/leaderboard", response_model=list[LeaderboardUser])
def get_leaderboard(db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(desc(models.User.points), models.User.created_at).limit(100).all()
    
    leaderboard = []
    current_rank = 1
    previous_points = None
    users_with_same_points = 0
    
    for i, user in enumerate(users):
        if previous_points is not None and user.points == previous_points:
            users_with_same_points += 1
        else:
            current_rank = i + 1
            users_with_same_points = 0
            
        leaderboard.append(LeaderboardUser(
            rank=current_rank,
            user_id=user.id,
            name=user.name,
            profile_picture_url=user.profile_picture_url,
            points=user.points
        ))
        previous_points = user.points
        
    return leaderboard

def evaluate_achievements(user: models.User, db: Session) -> list[dict]:
    achievements = []
    
    # 1. First Assessment
    has_assessment = db.query(models.AssessmentAttempt).filter(models.AssessmentAttempt.user_id == user.id).first()
    achievements.append({
        "id": "first_assessment",
        "title": "Assessment Pioneer",
        "description": "Completed your first skill assessment",
        "earned": bool(has_assessment),
        "icon": "??",
        "earned_at": has_assessment.created_at.isoformat() if has_assessment else None
    })
    
    # 2. Skill Badge Earned
    has_badge = db.query(models.UserSkill).filter(models.UserSkill.user_id == user.id, models.UserSkill.badge != None).first()
    achievements.append({
        "id": "first_badge",
        "title": "Badge Earner",
        "description": "Earned a skill badge",
        "earned": bool(has_badge),
        "icon": "??",
        "earned_at": has_badge.updated_at.isoformat() if has_badge and getattr(has_badge, 'updated_at', None) else None
    })
    
    # 3. First Learning Session
    has_session = db.query(models.Session).filter(
        or_(models.Session.tutor_id == user.id, models.Session.learner_id == user.id),
        models.Session.status == "completed"
    ).first()
    achievements.append({
        "id": "first_session",
        "title": "First Session",
        "description": "Completed your first learning session",
        "earned": bool(has_session),
        "icon": "??",
        "earned_at": has_session.updated_at.isoformat() if has_session else None
    })
    
    # 4. Five Sessions (Knowledge Exchange)
    session_count = db.query(models.Session).filter(
        or_(models.Session.tutor_id == user.id, models.Session.learner_id == user.id),
        models.Session.status == "completed"
    ).count()
    achievements.append({
        "id": "five_sessions",
        "title": "Knowledge Exchange",
        "description": "Completed 5 learning sessions",
        "earned": session_count >= 5,
        "icon": "??",
        "earned_at": None # We don't track exact time of 5th session easily
    })
    
    # 5. First Review
    has_review = db.query(models.Review).filter(models.Review.reviewer_id == user.id).first()
    achievements.append({
        "id": "first_review",
        "title": "Feedback Giver",
        "description": "Submitted your first review",
        "earned": bool(has_review),
        "icon": "?",
        "earned_at": has_review.created_at.isoformat() if has_review else None
    })
    
    # 6. Points Milestones
    achievements.append({
        "id": "points_500",
        "title": "Rising Star",
        "description": "Earned 500 points",
        "earned": user.points >= 500,
        "icon": "??",
        "earned_at": None
    })
    
    return achievements

@router.get("/summary", response_model=GamificationSummary)
def get_gamification_summary(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Calculate rank
    higher_users_count = db.query(models.User).filter(models.User.points > current_user.points).count()
    current_rank = higher_users_count + 1
    
    achievements = evaluate_achievements(current_user, db)
    
    milestones = [
        (100, "Getting Started"),
        (200, "Novice Learner"),
        (500, "Rising Star"),
        (1000, "SkillVerse Expert"),
        (5000, "SkillVerse Legend")
    ]
    
    next_milestone_points = None
    next_milestone_title = None
    for points, title in milestones:
        if current_user.points < points:
            next_milestone_points = points
            next_milestone_title = title
            break
            
    return GamificationSummary(
        total_points=current_user.points,
        current_rank=current_rank,
        achievements=achievements,
        next_milestone_points=next_milestone_points,
        next_milestone_title=next_milestone_title
    )
