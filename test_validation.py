from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic import BaseModel, EmailStr
from typing import Optional
import datetime as dt

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    mobile_number = Column(String, unique=True, index=True, nullable=True)
    is_email_verified = Column(Boolean, default=False)
    is_mobile_verified = Column(Boolean, default=False)
    college = Column(String, nullable=True) # Set to None!
    country = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    points = Column(Integer, nullable=True)
    dob = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    mobile_number: Optional[str] = None
    is_email_verified: bool = False
    is_mobile_verified: bool = False
    college: Optional[str] = ""
    country: Optional[str] = ""
    bio: Optional[str] = ""
    profile_picture_url: Optional[str] = None
    points: Optional[int] = 0
    dob: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    
    class Config:
        from_attributes = True

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
db = Session()

u = User(name="test", email="test@test.com", hashed_password="123", is_email_verified=True, college=None, country=None, bio=None, points=None)
db.add(u)
db.commit()
db.refresh(u)

try:
    print(UserOut.model_validate(u))
except Exception as e:
    print("CRASHED:", repr(e))
