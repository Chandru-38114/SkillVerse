from fastapi import APIRouter, Depends, HTTPException, status
import os
from .. import config
import random
import secrets
import string
import datetime as dt
from sqlalchemy.orm import Session
from sqlalchemy import or_
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .. import models, schemas, auth
from ..database import get_db
from ..email_service import send_otp_email


router = APIRouter(prefix="/auth", tags=["auth"])

raw_google_id = os.getenv("VITE_GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_ID = raw_google_id.strip().strip('"').strip("'") if raw_google_id else None

# In-memory rate limiting dictionary for login brute-force protection
login_attempts = {}

def check_login_rate_limit(identifier: str):
    now = dt.datetime.utcnow()
    if identifier in login_attempts:
        attempts, lockout_time = login_attempts[identifier]
        if lockout_time and now < lockout_time:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
        if lockout_time and now >= lockout_time:
            login_attempts[identifier] = (0, None)
    return True

def record_failed_login(identifier: str):
    now = dt.datetime.utcnow()
    if identifier not in login_attempts:
        login_attempts[identifier] = (1, None)
    else:
        attempts, lockout_time = login_attempts[identifier]
        attempts += 1
        if attempts >= 5:
            login_attempts[identifier] = (attempts, now + dt.timedelta(minutes=5))
        else:
            login_attempts[identifier] = (attempts, None)

def reset_login_attempts(identifier: str):
    if identifier in login_attempts:
        del login_attempts[identifier]


@router.post("/signup", response_model=schemas.Token)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        auth.validate_password_strength(payload.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    email = payload.email.strip().lower()
    existing_email = db.query(models.User).filter(models.User.email == email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    mobile_val = payload.mobile_number.strip() if payload.mobile_number and payload.mobile_number.strip() != "" else None
    if mobile_val:
        existing_mobile = db.query(models.User).filter(models.User.mobile_number == mobile_val).first()
        if existing_mobile:
            raise HTTPException(status_code=400, detail="Mobile number already registered")

    # Do not save to DB yet. Store in Fernet encrypted token.
    signup_data = {
        "name": payload.name,
        "email": email,
        "mobile_number": mobile_val,
        "hashed_password": auth.hash_password(payload.password),
        "college": payload.college,
        "country": payload.country or ""
    }
    signup_token = auth.create_encrypted_token(signup_data)
    
    return schemas.Token(
        signup_token=signup_token,
        onboarding_required=False
    )

@router.post("/verify-google-signup", response_model=schemas.Token)
def verify_google_signup(payload: schemas.GoogleSignupVerify, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google authentication is not configured on the server")

    signup_data = auth.verify_encrypted_token(payload.signup_token)
    if not signup_data:
        raise HTTPException(status_code=400, detail="Signup session expired or invalid. Please sign up again.")

    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        google_email = idinfo.get("email")
        if not google_email:
            raise HTTPException(status_code=400, detail="No email provided by Google")
            
        google_email = google_email.strip().lower()
        if google_email != signup_data["email"]:
            raise HTTPException(status_code=400, detail="Google email does not match registration email.")
            
        # Check DB one last time before insert
        if db.query(models.User).filter(models.User.email == google_email).first():
            raise HTTPException(status_code=400, detail="Email already registered")

        user = models.User(
            name=signup_data["name"],
            email=google_email,
            mobile_number=signup_data["mobile_number"],
            hashed_password=signup_data["hashed_password"],
            college=signup_data["college"],
            country=signup_data["country"],
            is_email_verified=True,
            is_mobile_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = auth.create_access_token({"sub": str(user.id)})
        return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))

    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    identifier = payload.email or payload.mobile_number
    if not identifier:
        raise HTTPException(status_code=400, detail="Must provide email or mobile number")

    check_login_rate_limit(identifier)

    # Prevent matching `mobile_number IS NULL` or `email IS NULL` by only using provided fields
    conditions = []
    if payload.email:
        conditions.append(models.User.email == payload.email)
    if payload.mobile_number:
        conditions.append(models.User.mobile_number == payload.mobile_number)

    user = db.query(models.User).filter(or_(*conditions)).first()

    if not user or not auth.verify_password(payload.password, user.hashed_password):
        record_failed_login(identifier)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials",
        )
        
    reset_login_attempts(identifier)
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
            
        email = email.strip().lower()
        user = db.query(models.User).filter(models.User.email == email).first()
        
        if user:
            # Login
            token = auth.create_access_token({"sub": str(user.id)})
            return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))
        else:
            # Onboarding Required
            onboarding_data = {
                "email": email,
                "name": name
            }
            onboarding_token = auth.create_encrypted_token(onboarding_data)
            return schemas.Token(
                onboarding_required=True,
                onboarding_token=onboarding_token
            )
            
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

@router.post("/complete-google", response_model=schemas.Token)
def complete_google(payload: schemas.GoogleOnboardingComplete, db: Session = Depends(get_db)):
    onboarding_data = auth.verify_encrypted_token(payload.onboarding_token)
    if not onboarding_data:
        raise HTTPException(status_code=400, detail="Onboarding session expired. Please sign in with Google again.")
        
    email = onboarding_data["email"].strip().lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Account already exists. Please log in.")
        
    try:
        auth.validate_password_strength(payload.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    mobile_val = payload.mobile_number.strip() if payload.mobile_number and payload.mobile_number.strip() != "" else None
    
    user = models.User(
        name=payload.name,
        email=email,
        mobile_number=mobile_val,
        hashed_password=auth.hash_password(payload.password),
        college=payload.college,
        country=payload.country or "",
        gender=payload.gender,
        dob=payload.dob,
        bio=payload.bio or "",
        is_email_verified=True,
        is_mobile_verified=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPassword, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    
    if not user:
        return {"detail": "If your email is registered, you will receive an OTP."}
        
    # Rate limit and time-based cooldown
    now = dt.datetime.utcnow()
    recent_otp = db.query(models.PasswordResetOTP).filter(
        models.PasswordResetOTP.email == payload.email
    ).order_by(models.PasswordResetOTP.created_at.desc()).first()
    
    if recent_otp and (now - recent_otp.created_at).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting another OTP.")
        
    otp = ''.join(secrets.choice(string.digits) for _ in range(6))
    
    # Invalidate previous OTPs
    db.query(models.PasswordResetOTP).filter(models.PasswordResetOTP.email == payload.email).delete()
    
    reset_entry = models.PasswordResetOTP(
        email=payload.email,
        hashed_otp=auth.hash_password(otp),
        expires_at=now + dt.timedelta(minutes=10)
    )
    db.add(reset_entry)
    db.commit()
    
    try:
        send_otp_email(payload.email, otp, purpose="password_reset")
        response = {"detail": "If your email is registered, you will receive an OTP."}
        if os.getenv("DEV_OTP_MODE", "true").lower() == "true":
            response["dev_otp"] = otp
        return response
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to send verification code. Please try again later.")


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPassword, db: Session = Depends(get_db)):
    try:
        auth.validate_password_strength(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    if auth.verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="You are entering your old password. Please choose a different password.")

        
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
        
    user.hashed_password = auth.hash_password(payload.new_password)
    db.query(models.PasswordResetOTP).filter(models.PasswordResetOTP.email == payload.email).delete()
    db.commit()
    
    return {"detail": "Password has been successfully reset."}

@router.post("/verify-email/request")
def request_email_verification(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.is_email_verified:
        return {"detail": "Email is already verified."}
        
    now = dt.datetime.utcnow()
    recent_otp = db.query(models.EmailVerificationOTP).filter(
        models.EmailVerificationOTP.user_id == current_user.id
    ).order_by(models.EmailVerificationOTP.created_at.desc()).first()
    
    if recent_otp and (now - recent_otp.created_at).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting another OTP.")
        
    otp = ''.join(secrets.choice(string.digits) for _ in range(6))
    
    # Invalidate previous OTPs
    db.query(models.EmailVerificationOTP).filter(models.EmailVerificationOTP.user_id == current_user.id).delete()
    
    entry = models.EmailVerificationOTP(
        user_id=current_user.id,
        hashed_otp=auth.hash_password(otp),
        expires_at=now + dt.timedelta(minutes=10)
    )
    db.add(entry)
    db.commit()
    
    try:
        send_otp_email(current_user.email, otp, purpose="email_verification")
        response = {"detail": "Verification OTP sent."}
        if os.getenv("DEV_OTP_MODE", "true").lower() == "true":
            response["dev_otp"] = otp
        return response
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to send verification code. Please try again later.")

@router.post("/verify-email/confirm")
def confirm_email_verification(payload: schemas.VerifyOTP, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if current_user.is_email_verified:
        return {"detail": "Email is already verified."}

    otp_record = db.query(models.EmailVerificationOTP).filter(
        models.EmailVerificationOTP.user_id == current_user.id,
        models.EmailVerificationOTP.expires_at > dt.datetime.utcnow()
    ).order_by(models.EmailVerificationOTP.created_at.desc()).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP expired or not found")
        
    if otp_record.attempts >= 5:
        raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a new OTP.")
        
    if not auth.verify_password(payload.otp, otp_record.hashed_otp):
        otp_record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    current_user.is_email_verified = True
    db.query(models.EmailVerificationOTP).filter(models.EmailVerificationOTP.user_id == current_user.id).delete()
    db.commit()
    
    return {"detail": "Email successfully verified."}




