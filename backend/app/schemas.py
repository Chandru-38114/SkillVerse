import re
import datetime as dt
from typing import Dict, Any, Optional, List, Union
from pydantic import BaseModel, Field, EmailStr, Field, model_validator, ConfigDict

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

from pydantic import field_validator


def _as_utc(v):
    """SQLite returns naive datetimes; the backend stores UTC. Mark them as
    UTC so browsers don't read them as local (IST) time — otherwise timers
    show "Ends in 00:00" and sessions look expired 5h30m early."""
    if isinstance(v, dt.datetime) and v.tzinfo is None:
        return v.replace(tzinfo=dt.timezone.utc)
    return v


def _normalize_email(v):
    # Signup stores emails as strip().lower(); every lookup must match that,
    # otherwise "Alex@Example.com" can never log in or reset a password.
    return v.strip().lower() if isinstance(v, str) else v


class UserLogin(BaseModel):
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    password: str

    _norm_email = field_validator('email', mode='before')(classmethod(lambda cls, v: _normalize_email(v) or None))

class GoogleAuth(BaseModel):
    credential: str  # The ID token from Google

class ForgotPassword(BaseModel):
    email: EmailStr

    _norm_email = field_validator('email', mode='before')(classmethod(lambda cls, v: _normalize_email(v)))

class ResetPassword(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

    _norm_email = field_validator('email', mode='before')(classmethod(lambda cls, v: _normalize_email(v)))

    @field_validator('new_password')
    @classmethod
    def validate_strength(cls, v: str) -> str:
        if len(v) < 6 or not re.search(r'[A-Z]', v) or not re.search(r'[a-z]', v) or not re.search(r'[0-9]', v) or not re.search(r'[^a-zA-Z0-9]', v):
            raise ValueError('Password must contain at least 6 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return v

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    mobile_number: Optional[str] = None
    is_email_verified: Optional[bool] = False
    is_mobile_verified: Optional[bool] = False
    college: Optional[str] = ""
    country: Optional[str] = ""
    bio: Optional[str] = ""
    profile_picture_url: Optional[str] = None
    points: Optional[int] = 0
    dob: Optional[Union[dt.date, str]] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    created_at: Optional[dt.datetime] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    mobile_number: Optional[str] = None
    college: Optional[str] = None
    country: Optional[str] = None
    dob: Optional[Union[dt.date, str]] = None
    gender: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserOut] = None
    dev_otp: Optional[str] = None
    onboarding_required: Optional[bool] = False
    onboarding_token: Optional[str] = None
    signup_token: Optional[str] = None

class GoogleSignupVerify(BaseModel):
    signup_token: str
    credential: str

class GoogleOnboardingComplete(BaseModel):
    onboarding_token: str
    name: str
    mobile_number: str
    college: str
    password: str
    confirm_password: str
    country: Optional[str] = ""
    dob: Optional[Union[dt.date, str]] = None
    gender: Optional[str] = None
    bio: Optional[str] = ""

    @model_validator(mode='after')
    def check_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        pw = self.password
        if len(pw) < 6 or not re.search(r'[A-Z]', pw) or not re.search(r'[a-z]', pw) or not re.search(r'[0-9]', pw) or not re.search(r'[^a-zA-Z0-9]', pw):
            raise ValueError('Password must contain at least 6 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return self


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
    attempt_id: Optional[str] = None  # from POST /assessments/start; scored against the server's stored copy
    violations: int = 0  # client-reported; recorded as evidence only, never affects the score
    terminated: bool = False

class AssessmentStart(BaseModel):
    skill_name: str
    level: Optional[str] = None


class AssessmentResult(BaseModel):
    score: float
    level: str
    badge: Optional[str]
    weak_topics: List[str]
    study_plan: List[str]
    violations: int = 0
    terminated: bool = False
    counted: Optional[bool] = None


class AssessmentAttemptOut(BaseModel):
    id: int
    user_id: int
    skill_id: int
    score: float
    weak_topics: str
    created_at: dt.datetime

    class Config:
        from_attributes = True


class SkillBadgeInfo(BaseModel):
    skill_name: str
    level: str
    badge: Optional[str]
    score: Optional[float]
    level_num: Optional[int] = 0

class TeacherPublicSummary(BaseModel):
    average_rating: Optional[float] = None
    review_count: int = 0
    sessions_taught: int = 0
    teaching_since: str

class MarketplaceUser(BaseModel):
    user_id: int
    name: str
    college: str
    teaching_skills: List[SkillBadgeInfo]
    learning_skills: List[SkillBadgeInfo]
    match_context: Optional[str] = None
    match_score: int = 0
    teacher_stats: Optional[TeacherPublicSummary] = None
    average_rating: Optional[float] = None
    review_count: Optional[int] = None
    sessions_taught: Optional[int] = None
    teaching_since: Optional[str] = None
    connection_statuses: Dict[str, dict] = {}

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
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MessageOut(BaseModel):
    id: int
    sender_id: int
    content: str
    is_read: bool = False
    created_at: dt.datetime
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="message_metadata", serialization_alias="metadata")

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
    other_last_active: Optional[dt.datetime] = None
    session_date: Optional[str] = None
    session_time: Optional[str] = None
    scheduled_start: Optional[dt.datetime] = None
    scheduled_end: Optional[dt.datetime] = None
    # Every request id between this pair (the inbox shows one conversation per
    # person), so links like /messages?request_id=<any of them> resolve.
    request_ids: List[int] = []

    _utc_times = field_validator('scheduled_start', 'scheduled_end', 'latest_message_time', 'other_last_active')(classmethod(lambda cls, v: _as_utc(v)))


class MessageEdit(BaseModel):
    content: str


class ReactionUpdate(BaseModel):
    emoji: str

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
    session_date: Optional[str] = None
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    scheduled_start: dt.datetime
    scheduled_end: dt.datetime
    notes:        Optional[str] = None

    @field_validator('scheduled_start', 'scheduled_end')
    @classmethod
    def ensure_tz_aware(cls, v: dt.datetime) -> dt.datetime:
        if v.tzinfo is None:
            v = v.replace(tzinfo=dt.timezone.utc)
        # Store in UTC: SQLite drops the offset, and the rest of the backend
        # reads naive values as UTC — an IST value would be 5h30m off.
        return v.astimezone(dt.timezone.utc)


class SessionUpdate(BaseModel):
    session_date: Optional[str] = None
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    scheduled_start: Optional[dt.datetime] = None
    scheduled_end: Optional[dt.datetime] = None
    notes:        Optional[str] = None

    @field_validator('scheduled_start', 'scheduled_end')
    @classmethod
    def ensure_tz_aware(cls, v: Optional[dt.datetime]) -> Optional[dt.datetime]:
        if v and v.tzinfo is None:
            v = v.replace(tzinfo=dt.timezone.utc)
        return v.astimezone(dt.timezone.utc) if v else v


class SessionOut(BaseModel):
    id:           int
    request_id:   int
    tutor_id:     int
    tutor_name:   str
    learner_id:   int
    learner_name: str
    skill:        str
    session_date: Optional[str] = None
    start_time:   Optional[str] = None
    end_time:     Optional[str] = None
    scheduled_start: Optional[dt.datetime] = None
    scheduled_end: Optional[dt.datetime] = None
    status:       str
    notes:        Optional[str]
    request:      Optional[ConnectionRequestOut] = None
    created_at:   dt.datetime
    updated_at:   dt.datetime

    _utc_times = field_validator('scheduled_start', 'scheduled_end', 'created_at', 'updated_at')(classmethod(lambda cls, v: _as_utc(v)))

    class Config:
        from_attributes = True


# "?"? Progress History "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

class SessionProgressUpdate(BaseModel):
    topics_discussed: Optional[str] = None
    topics_completed: Optional[str] = None
    learning_notes: Optional[str] = None
    semantic_summary: Optional[str] = None

class SessionProgressOut(BaseModel):
    id: int
    session_id: int
    user_id: int
    skill_id: int
    topics_discussed: str
    topics_completed: str
    learning_notes: str
    semantic_summary: Optional[str] = None
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
    stage: str = "Discovered"
    what_happened: str = ""
    next_milestone: str = ""
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


# ── Report Card & Teacher Stats Schemas ──────────────────────────────────────

class SkillOverviewItem(BaseModel):
    skill_name: str
    level_num: int
    best_score: Optional[float] = None
    counted_weeks: int
    trend: str  # "up", "down", "flat"


class ProgressHistoryEntry(BaseModel):
    week_start: str  # YYYY-MM-DD
    score: float


class ProgressHistoryItem(BaseModel):
    skill_name: str
    history: List[ProgressHistoryEntry]


class LearningActivitySummary(BaseModel):
    sessions_attended: int
    total_learning_minutes: int
    distinct_skills_learned: List[str]


class TeachingActivitySummary(BaseModel):
    sessions_given: int
    total_teaching_minutes: int
    distinct_skills_taught: List[str]


class CompletedExchangeItem(BaseModel):
    group_id: int
    kind: str  # "pair" or "cycle"
    other_members: List[str]  # names only, no sensitive info


class PointsBreakdown(BaseModel):
    total: int
    split: Optional[Dict[str, int]] = None  # e.g. {"assessment": X, "teaching": Y, "review": Z, "initial": W}


class ReviewCommentItem(BaseModel):
    rating: int
    comment: str
    created_at: dt.datetime


class ReportCardOut(BaseModel):
    skills_overview: List[SkillOverviewItem]
    progress_history: List[ProgressHistoryItem]
    learning_activity: LearningActivitySummary
    teaching_activity: TeachingActivitySummary
    exchange_history: List[CompletedExchangeItem]
    points_breakdown: PointsBreakdown
    reviews_received: Dict[str, Any]  # average_rating, review_count, recent_reviews: List[ReviewCommentItem]


class StarBreakdown(BaseModel):
    star_5: int = 0
    star_4: int = 0
    star_3: int = 0
    star_2: int = 0
    star_1: int = 0


class TeacherSkillBreakdownItem(BaseModel):
    skill_name: str
    level_num: int
    sessions_taught: int
    average_rating: Optional[float] = None


class TeacherStatsOut(BaseModel):
    has_taught: bool
    teaching_experience: Optional[Dict[str, Any]] = None  # total_hours_taught, teaching_since
    rating_summary: Optional[Dict[str, Any]] = None       # average_rating, review_count, star_breakdown
    session_stats: Optional[Dict[str, Any]] = None        # total_sessions_taught, average_session_length
    students_help: Optional[Dict[str, Any]] = None        # distinct_learners_taught, returning_students_count
    skill_breakdown: Optional[List[TeacherSkillBreakdownItem]] = None
    reliability: Optional[Dict[str, Any]] = None          # completion_rate, completed_sessions, cancelled_or_unscheduled, total_accepted_requests
    recent_reviews: Optional[List[ReviewCommentItem]] = None


# ── Demand Request Schemas ───────────────────────────────────────────────────

class DemandRequestCreate(BaseModel):
    skill_id: Optional[int] = None
    skill_name: Optional[str] = None


class DemandRequestOut(BaseModel):
    id: int
    requester_id: int
    skill_id: int
    skill_name: Optional[str] = None
    learner_level_num: int
    status: str
    created_at: dt.datetime

    class Config:
        from_attributes = True


class DemandTeacherOut(BaseModel):
    id: int
    user_id: int
    name: str
    college: Optional[str] = ""
    level_num: int
    skill_name: str


class DemandResponse(BaseModel):
    status: str
    message: str
    teacher: Optional[DemandTeacherOut] = None
    demand_request: Optional[DemandRequestOut] = None
    # Top-level helper fields for direct access
    id: Optional[int] = None
    user_id: Optional[int] = None
    requester_id: Optional[int] = None
    name: Optional[str] = None
    skill_id: Optional[int] = None
    skill_name: Optional[str] = None
    level_num: Optional[int] = None
    learner_level_num: Optional[int] = None

# ── Community Lounge Schemas ────────────────────────────────────────────────

class CommunityAccessOut(BaseModel):
    has_taught: bool


class LoungePostCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Post body cannot be blank.")
        if len(s) > 2000:
            raise ValueError("Post body cannot exceed 2000 characters.")
        return s


class LoungeCommentCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Comment body cannot be blank.")
        if len(s) > 1000:
            raise ValueError("Comment body cannot exceed 1000 characters.")
        return s


class LoungeCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    author_id: int
    author_name: str
    author_college: Optional[str] = ""
    author_avatar_url: Optional[str] = None
    body: str
    created_at: dt.datetime


class LoungePostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    author_name: str
    author_college: Optional[str] = ""
    author_avatar_url: Optional[str] = None
    body: str
    created_at: dt.datetime
    edited_at: Optional[dt.datetime] = None
    comment_count: int = 0


class LoungePostDetailOut(LoungePostOut):
    comments: List[LoungeCommentOut] = []


# ── Study Circles Schemas ───────────────────────────────────────────────────

class StudyCircleCreate(BaseModel):
    title: str
    description: str
    skill_id: Optional[int] = None
    scheduled_at: dt.datetime
    max_participants: Optional[int] = 8

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Title cannot be blank.")
        if len(s) > 200:
            raise ValueError("Title cannot exceed 200 characters.")
        return s

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Description cannot be blank.")
        if len(s) > 2000:
            raise ValueError("Description cannot exceed 2000 characters.")
        return s

    @field_validator("max_participants")
    @classmethod
    def validate_max_participants(cls, v: Optional[int]) -> int:
        val = v if v is not None else 8
        if val < 2 or val > 50:
            raise ValueError("Max participants must be between 2 and 50.")
        return val


class StudyCircleParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    circle_id: int
    user_id: int
    user_name: str
    user_college: Optional[str] = ""
    user_avatar_url: Optional[str] = None
    joined_at: dt.datetime


class StudyCircleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    host_id: int
    host_name: str
    host_college: Optional[str] = ""
    host_avatar_url: Optional[str] = None
    skill_id: Optional[int] = None
    skill_name: Optional[str] = None
    scheduled_at: dt.datetime
    max_participants: int
    status: str
    created_at: dt.datetime
    participant_count: int = 0
    is_joined: bool = False
    is_host: bool = False
    participants: List[StudyCircleParticipantOut] = []


# ── Ask-a-Senior Schemas ─────────────────────────────────────────────────────

class SeniorQuestionCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Question body cannot be blank.")
        if len(s) > 3000:
            raise ValueError("Question body cannot exceed 3000 characters.")
        return s


class SeniorAnswerCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Answer body cannot be blank.")
        if len(s) > 3000:
            raise ValueError("Answer body cannot exceed 3000 characters.")
        return s


class SeniorAnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    author_id: int
    author_name: str
    author_college: Optional[str] = ""
    author_avatar_url: Optional[str] = None
    body: str
    created_at: dt.datetime


class SeniorQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_id: int
    author_name: str
    author_college: Optional[str] = ""
    author_avatar_url: Optional[str] = None
    body: str
    status: str
    created_at: dt.datetime
    answer_count: int = 0


class SeniorQuestionDetailOut(SeniorQuestionOut):
    answers: List[SeniorAnswerOut] = []


# ── Weekly Challenges Schemas ────────────────────────────────────────────────

class WeeklyChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prompt: str
    week_start: dt.date
    created_at: dt.datetime
    response_count: int = 0
    has_responded: bool = False


class WeeklyChallengeResponseCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Response body cannot be blank.")
        if len(s) > 3000:
            raise ValueError("Response body cannot exceed 3000 characters.")
        return s


class WeeklyChallengeResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    challenge_id: int
    user_id: int
    user_name: str
    user_college: Optional[str] = ""
    user_avatar_url: Optional[str] = None
    body: str
    created_at: dt.datetime


# ── Hackathons Schemas ───────────────────────────────────────────────────────

class HackathonCreate(BaseModel):
    title: str
    description: str
    starts_at: dt.datetime
    ends_at: dt.datetime

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Title cannot be blank.")
        if len(s) > 200:
            raise ValueError("Title cannot exceed 200 characters.")
        return s

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("Description cannot be blank.")
        if len(s) > 3000:
            raise ValueError("Description cannot exceed 3000 characters.")
        return s


class HackathonParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hackathon_id: int
    user_id: int
    user_name: str
    user_college: Optional[str] = ""
    user_avatar_url: Optional[str] = None
    joined_at: dt.datetime


class HackathonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    host_id: int
    host_name: str
    host_college: Optional[str] = ""
    host_avatar_url: Optional[str] = None
    starts_at: dt.datetime
    ends_at: dt.datetime
    status: str
    created_at: dt.datetime
    participant_count: int = 0
    is_joined: bool = False
    is_host: bool = False


# ── Teacher Badge Schemas ───────────────────────────────────────────────────

class TeacherBadgeOut(BaseModel):
    id: str
    name: str
    tier: str
    description: str
    icon: str
    earned: bool = True
    earned_at: Optional[str] = None


class TeacherBadgeDefinitionOut(BaseModel):
    id: str
    name: str
    tier: str
    description: str
    icon: str
    computable: bool
    stubbed: Optional[bool] = False
    stub_reason: Optional[str] = None
