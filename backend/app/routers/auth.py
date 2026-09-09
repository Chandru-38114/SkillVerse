from fastapi import APIRouter, Depends, HTTPException, status
import os
import random
import string
import datetime as dt
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .. import models, schemas, auth
from ..database import get_db
from ..email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("VITE_GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")


@router.post("/signup", response_model=schemas.Token)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=auth.hash_password(payload.password),
        college=payload.college or "",
        country=payload.country or "",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))

@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/google", response_model=schemas.Token)
def google_auth(payload: schemas.GoogleAuth, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google authentication is not configured on the server")
        
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        email = idinfo.get("email")
        name = idinfo.get("name", "Google User")
        if not email:
            raise HTTPException(status_code=400, detail="No email provided by Google")
            
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            # Create user with a secure random password since they use Google Auth
            random_pwd = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
            user = models.User(
                name=name,
                email=email,
                hashed_password=auth.hash_password(random_pwd),
                college="",
                country=""
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        token = auth.create_access_token({"sub": str(user.id)})
        return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPassword, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    
    # We always return 200 to prevent email enumeration attacks
    if not user:
        return {"detail": "If your email is registered, you will receive an OTP."}
        
    # Check rate limiting (e.g., maximum 3 active OTPs)
    recent_otps = db.query(models.PasswordResetOTP).filter(
        models.PasswordResetOTP.email == payload.email,
        models.PasswordResetOTP.expires_at > dt.datetime.utcnow()
    ).count()
    
    if recent_otps >= 3:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Please wait before trying again.")
        
    # Generate OTP
    otp = ''.join(random.choices(string.digits, k=6))
    
    reset_entry = models.PasswordResetOTP(
        email=payload.email,
        hashed_otp=auth.hash_password(otp),
        expires_at=dt.datetime.utcnow() + dt.timedelta(minutes=10)
    )
    db.add(reset_entry)
    db.commit()
    
    send_otp_email(payload.email, otp)
    
    return {"detail": "If your email is registered, you will receive an OTP."}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPassword, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")
        
    # Find active OTP record
    otp_record = db.query(models.PasswordResetOTP).filter(
        models.PasswordResetOTP.email == payload.email,
        models.PasswordResetOTP.expires_at > dt.datetime.utcnow()
    ).order_by(models.PasswordResetOTP.created_at.desc()).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP expired or not found")
        
    if otp_record.attempts >= 5:
        raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a new OTP.")
        
    if not auth.verify_password(payload.otp, otp_record.hashed_otp):
        otp_record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Valid OTP! Update password
    user.hashed_password = auth.hash_password(payload.new_password)
    
    # Invalidate this OTP (and optionally all others for this email)
    db.query(models.PasswordResetOTP).filter(models.PasswordResetOTP.email == payload.email).delete()
    db.commit()
    
    return {"detail": "Password has been successfully reset."}