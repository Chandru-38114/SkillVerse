import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    college: Optional[str] = ""
    country: Optional[str] = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    college: str
    country: str
    bio: str
    points: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserSkillOut(BaseModel):
    id: int
    skill_id: int
    skill_name: str
    role: str
    latest_score: Optional[float]
    level: str
    badge: Optional[str]

    class Config:
        from_attributes = True


class AssessmentSubmitAnswer(BaseModel):
    question_id: str
    answer: str


class AssessmentSubmit(BaseModel):
    skill_name: str
    role: str = "teaching"  # what the assessment result is used for
    answers: List[AssessmentSubmitAnswer]


class AssessmentResult(BaseModel):
    score: float
    level: str
    badge: Optional[str]
    weak_topics: List[str]
    study_plan: List[str]


class MarketplaceTeacher(BaseModel):
    user_id: int
    name: str
    college: str
    skill_name: str
    level: str
    badge: Optional[str]
    score: Optional[float]


class ConnectionRequestCreate(BaseModel):
    to_user_id: int
    skill_name: str
    message: Optional[str] = ""


class ConnectionRequestOut(BaseModel):
    id: int
    from_user_id: int
    from_user_name: str
    to_user_id: int
    to_user_name: str
    skill_name: str
    message: str
    status: str
    created_at: dt.datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: int
    sender_id: int
    content: str
    created_at: dt.datetime

    class Config:
        from_attributes = True


# ── Reviews ──────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    """Client sends only rating + optional comment.
    reviewer / reviewee / request are derived server-side."""
    rating: int          # 1–5, validated in the router
    comment: Optional[str] = ""


class ReviewOut(BaseModel):
    id: int
    reviewer_id: int
    reviewer_name: str
    reviewee_id: int
    request_id: int
    rating: int
    comment: str
    created_at: dt.datetime

    class Config:
        from_attributes = True


class UserReviewSummary(BaseModel):
    """Aggregated review info surfaced on marketplace / profile."""
    average_rating: Optional[float]   # None when no reviews yet
    review_count: int
    reviews: List[ReviewOut]