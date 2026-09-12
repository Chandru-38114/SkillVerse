import re
import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, EmailStr, model_validator

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    mobile_number: str
    college: str
    password: str
    confirm_password: str
    country: Optional[str] = ""

    @model_validator(mode='after')
    def check_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        pw = self.password
        if len(pw) < 6 or not re.search(r'[A-Z]', pw) or not re.search(r'[a-z]', pw) or not re.search(r'[0-9]', pw) or not re.search(r'[^a-zA-Z0-9]', pw):
            raise ValueError('Password must contain at least 6 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return self

class UserLogin(BaseModel):
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    password: str

class GoogleAuth(BaseModel):
    credential: str  # The ID token from Google

class ForgotPassword(BaseModel):
    email: EmailStr

from pydantic import field_validator
class ResetPassword(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_strength(cls, v: str) -> str:
        if len(v) < 6 or not re.search(r'[A-Z]', v) or not re.search(r'[a-z]', v) or not re.search(r'[0-9]', v) or not re.search(r'[^a-zA-Z0-9]', v):
            raise ValueError('Password must contain at least 6 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return v

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    mobile_number: Optional[str] = None
    is_email_verified: bool = False
    is_mobile_verified: bool = False
    college: str
    country: str
    bio: str
    profile_picture_url: Optional[str] = None
    points: int

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    mobile_number: Optional[str] = None
    college: Optional[str] = None
    country: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

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


class SkillBadgeInfo(BaseModel):
    skill_name: str
    level: str
    badge: Optional[str]
    score: Optional[float]

class MarketplaceUser(BaseModel):
    user_id: int
    name: str
    college: str
    teaching_skills: List[SkillBadgeInfo]
    learning_skills: List[SkillBadgeInfo]
    match_context: Optional[str] = None
    match_score: int = 0

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
    is_read: bool = False
    created_at: dt.datetime

    class Config:
        from_attributes = True

class InboxConversationOut(BaseModel):
    request_id: int
    other_user_id: int
    other_user_name: str
    other_user_avatar: Optional[str] = None
    skill_name: str
    latest_message: str
    latest_message_time: Optional[dt.datetime] = None
    unread_count: int = 0
    request_status: str
    session_id: Optional[int] = None
    session_date: Optional[str] = None
    session_time: Optional[str] = None

class NotificationOut(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: dt.datetime
    related_id: Optional[int] = None
    related_type: Optional[str] = None

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


# "?"? Progress History "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

class SessionProgressUpdate(BaseModel):
    topics_discussed: Optional[str] = None
    topics_completed: Optional[str] = None
    learning_notes: Optional[str] = None

class SessionProgressOut(BaseModel):
    id: int
    session_id: int
    user_id: int
    skill_id: int
    topics_discussed: str
    topics_completed: str
    learning_notes: str
    duration_minutes: int
    level_before: Optional[str] = None
    level_after: Optional[str] = None
    progress_percentage_before: int
    progress_percentage_after: int
    created_at: dt.datetime
    updated_at: dt.datetime
    
    # Helpful nested info for the history view
    session: Optional[SessionOut] = None

    class Config:
        from_attributes = True

class UserSkillProgressOut(UserSkillOut):
    progress_percentage: int
    sessions_completed: int
    total_learning_minutes: int
    assessment_count: int = 0
    # Add history for the detail view
    history: List[SessionProgressOut] = []

class CertificateGenerateRequest(BaseModel):
    skill_name: str

class CertificateOut(BaseModel):
    id: int
    certificate_id: str
    user_id: int
    user_name: Optional[str] = None
    skill_id: int
    skill_name: Optional[str] = None
    issue_date: dt.datetime
    level: str
    badge: str
    sessions_completed: int
    progress_percentage: int

    class Config:
        from_attributes = True

class VerifyOTP(BaseModel):
    otp: str

