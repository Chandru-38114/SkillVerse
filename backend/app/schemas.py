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


class GoogleAuth(BaseModel):
    credential: str  # The ID token from Google


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    email: EmailStr
    otp: str
    new_password: str



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
    # Two-way learning context — all optional so old callers still work
    learner_current_level: Optional[str] = None      # e.g. "Beginner"
    learner_topics: Optional[str] = None             # comma-separated, e.g. "Loops, Functions"
    learner_goals: Optional[str] = None              # free-text
    learner_can_teach: Optional[str] = None          # comma-separated skill names
    learner_teach_proficiency: Optional[str] = None  # e.g. "Intermediate"


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
    # Two-way learning context (nullable — may be absent for old requests)
    learner_current_level: Optional[str] = None
    learner_topics: Optional[str] = None
    learner_goals: Optional[str] = None
    learner_can_teach: Optional[str] = None
    learner_teach_proficiency: Optional[str] = None

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


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    request_id:   int
    session_date: str           # "YYYY-MM-DD"
    start_time:   str           # "HH:MM"
    end_time:     str           # "HH:MM"
    notes:        Optional[str] = None


class SessionUpdate(BaseModel):
    session_date: Optional[str] = None
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    notes:        Optional[str] = None


class SessionOut(BaseModel):
    id:           int
    request_id:   int
    tutor_id:     int
    tutor_name:   str
    learner_id:   int
    learner_name: str
    skill:        str
    session_date: str
    start_time:   str
    end_time:     str
    status:       str
    notes:        Optional[str]
    request:      Optional[ConnectionRequestOut] = None
    created_at:   dt.datetime
    updated_at:   dt.datetime

    class Config:
        from_attributes = True
