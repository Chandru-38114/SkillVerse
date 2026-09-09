import datetime as dt
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    college = Column(String, default="")
    country = Column(String, default="")
    bio = Column(String, default="")
    points = Column(Integer, default=100)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    user_skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")
    sent_requests = relationship("ConnectionRequest", foreign_keys="ConnectionRequest.from_user_id", back_populates="from_user")
    received_requests = relationship("ConnectionRequest", foreign_keys="ConnectionRequest.to_user_id", back_populates="to_user")


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