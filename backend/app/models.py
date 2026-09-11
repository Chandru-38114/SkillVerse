import datetime as dt
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, DateTime, Date, Text, Boolean
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    mobile_number = Column(String, unique=True, index=True, nullable=True)
    is_email_verified = Column(Boolean, default=False)
    is_mobile_verified = Column(Boolean, default=False)
    college = Column(String, default="")
    dob = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    country = Column(String, default="")
    bio = Column(String, default="")
    profile_picture_url = Column(String, nullable=True)
    points = Column(Integer, default=100)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    
    @property
    def age(self):
        if self.dob:
            today = dt.date.today()
            return today.year - self.dob.year - ((today.month, today.day) < (self.dob.month, self.dob.day))
        return None

    user_skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    sent_requests = relationship("ConnectionRequest", foreign_keys="ConnectionRequest.from_user_id", back_populates="from_user")
    received_requests = relationship("ConnectionRequest", foreign_keys="ConnectionRequest.to_user_id", back_populates="to_user")

class EmailVerificationOTP(Base):
    __tablename__ = "email_verification_otps"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hashed_otp = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class MobileVerificationOTP(Base):
    __tablename__ = "mobile_verification_otps"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hashed_otp = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class PasswordResetOTP(Base):
    """Tracks OTP generation for forgot password."""
    __tablename__ = "password_reset_otps"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    hashed_otp = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)


class UserSkill(Base):
    """A skill a user knows (or is learning), with assessment results + badge."""
    __tablename__ = "user_skills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    role = Column(String, default="learning")  # "teaching" or "learning"
    latest_score = Column(Float, nullable=True)
    level = Column(String, default="Unassessed")  # Beginner / Intermediate / Advanced
    badge = Column(String, nullable=True)  # Bronze / Silver / Gold / Expert
    
    # --- Session Progress & Knowledge History fields ---
    progress_percentage = Column(Integer, default=0)
    sessions_completed = Column(Integer, default=0)
    total_learning_minutes = Column(Integer, default=0)
    
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    user = relationship("User", back_populates="user_skills")
    skill = relationship("Skill")


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    score = Column(Float, nullable=False)
    weak_topics = Column(Text, default="")  # comma-separated
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class ConnectionRequest(Base):
    __tablename__ = "connection_requests"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    message = Column(String, default="")
    status = Column(String, default="pending")  # pending / accepted / declined / completed
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    # ── Two-way learning context (added for rich requests) ────────────────────
    # What the learner (from_user) wants
    learner_current_level = Column(String, nullable=True)       # Beginner / Intermediate / Advanced
    learner_topics        = Column(Text, nullable=True)         # comma-separated topics to improve
    learner_goals         = Column(Text, nullable=True)         # free-text learning goals
    # What the learner can offer in return
    learner_can_teach     = Column(Text, nullable=True)         # comma-separated skill names
    learner_teach_proficiency = Column(String, nullable=True)   # e.g. Beginner / Intermediate / Advanced

    from_user = relationship("User", foreign_keys=[from_user_id], back_populates="sent_requests")
    to_user = relationship("User", foreign_keys=[to_user_id], back_populates="received_requests")
    skill = relationship("Skill")



class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("connection_requests.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)

    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    request_id = Column(
        Integer,
        ForeignKey("connection_requests.id"),
        nullable=False
    )

    rating = Column(Integer, nullable=False)
    comment = Column(Text, default="")
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    reviewer = relationship(
        "User",
        foreign_keys=[reviewer_id]
    )

    reviewee = relationship(
        "User",
        foreign_keys=[reviewee_id]
    )

    request = relationship("ConnectionRequest")


class Session(Base):
    """A scheduled learning session between two participants of an accepted request."""
    __tablename__ = "sessions"

    id         = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("connection_requests.id"), nullable=False)
    tutor_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    learner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    skill        = Column(String, nullable=False)
    session_date = Column(String, nullable=False)   # ISO date string: "YYYY-MM-DD"
    start_time   = Column(String, nullable=False)   # "HH:MM"
    end_time     = Column(String, nullable=False)   # "HH:MM"

    # scheduled → completed | cancelled
    status = Column(String, default="scheduled", nullable=False)
    notes  = Column(Text, nullable=True)            # optional notes / agenda

    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    request = relationship("ConnectionRequest")
    tutor   = relationship("User", foreign_keys=[tutor_id])
    learner = relationship("User", foreign_keys=[learner_id])


class WhiteboardState(Base):
    """Stores the current saved state of a session's whiteboard."""
    __tablename__ = "whiteboard_states"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), unique=True, nullable=False)
    state = Column(Text, nullable=False, default="[]")  # JSON string of whiteboard elements
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)
    
    session = relationship("Session")

class CompilerState(Base):
    __tablename__ = "compiler_states"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), unique=True, nullable=False)
    code = Column(Text, nullable=False, default='print("Hello, SkillVerse!")')
    version = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)
    
    session = relationship("Session")


class LearningMaterial(Base):
    """Learning materials uploaded within a session."""
    __tablename__ = "learning_materials"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False, unique=True)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    
    session = relationship("Session")
    uploader = relationship("User", foreign_keys=[uploaded_by])

class SessionProgress(Base):
    """Historical record of session completion, topics, and notes per participant."""
    __tablename__ = "session_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    
    topics_discussed = Column(Text, default="")
    topics_completed = Column(Text, default="")
    learning_notes = Column(Text, default="")
    
    duration_minutes = Column(Integer, default=0)
    level_before = Column(String, nullable=True)
    level_after = Column(String, nullable=True)
    progress_percentage_before = Column(Integer, default=0)
    progress_percentage_after = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    updated_at = Column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)
    
    session = relationship("Session")
    user = relationship("User", foreign_keys=[user_id])
    skill = relationship("Skill")


class Certificate(Base):
    """A snapshot of a user's achievement for a specific skill when they meet certification requirements."""
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    
    issue_date = Column(DateTime, default=dt.datetime.utcnow)
    level = Column(String, nullable=False)
    badge = Column(String, nullable=False)
    sessions_completed = Column(Integer, default=0)
    progress_percentage = Column(Integer, default=0)

    user = relationship("User", foreign_keys=[user_id])
    skill = relationship("Skill", foreign_keys=[skill_id])

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False) # e.g., 'request', 'message', 'session', 'assessment', 'review', 'certificate'
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    related_id = Column(Integer, nullable=True)
    related_type = Column(String, nullable=True)

    user = relationship("User")


