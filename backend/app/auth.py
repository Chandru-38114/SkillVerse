import os
import datetime as dt
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from . import models

# Read the JWT secret from the environment.
# In production you MUST set the SECRET_KEY environment variable to a strong
# random value (e.g.  openssl rand -hex 32).  The fallback below is only for
# local development; starting the server without a real secret in production
# is a critical security risk.
_DEV_SECRET = "dev-secret-change-me-before-you-launch"
SECRET_KEY = os.environ.get("SECRET_KEY", _DEV_SECRET)
if SECRET_KEY == _DEV_SECRET and not os.getenv("DATABASE_URL", "sqlite").startswith("sqlite"):
    # Production database but the public dev secret: anyone could forge a
    # login token for any user. Shout in the Render logs (not crashing, so the
    # live site keeps running until the variable is set).
    import logging as _logging
    _logging.getLogger("skillverse.security").critical(
        "SECRET_KEY is not set on a production database — set it on Render NOW "
        "(e.g. output of `openssl rand -hex 32`). Login tokens can be forged until then."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


import base64
import hashlib
import json
from cryptography.fernet import Fernet, InvalidToken

def get_fernet() -> Fernet:
    # Derive a 32-byte url-safe base64 key from SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest())
    return Fernet(key)

def create_encrypted_token(data: dict, expires_delta: Optional[dt.timedelta] = None) -> str:
    """Creates a securely encrypted token containing arbitrary JSON data and an expiration."""
    expire = dt.datetime.utcnow() + (expires_delta or dt.timedelta(minutes=15))
    payload = {
        "data": data,
        "exp": expire.timestamp()
    }
    f = get_fernet()
    return f.encrypt(json.dumps(payload).encode()).decode()

def verify_encrypted_token(token: str) -> Optional[dict]:
    """Decrypts token and returns data if not expired, else None."""
    f = get_fernet()
    try:
        decrypted = f.decrypt(token.encode(), ttl=None)  # We handle TTL via payload
        payload = json.loads(decrypted.decode())
        if dt.datetime.utcnow().timestamp() > payload.get("exp", 0):
            return None
        return payload.get("data")
    except (InvalidToken, json.JSONDecodeError, ValueError):
        return None

def create_access_token(data: dict, expires_delta: Optional[dt.timedelta] = None) -> str:
    to_encode = data.copy()
    expire = dt.datetime.utcnow() + (expires_delta or dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_user_id_from_token_sync(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            return int(user_id)
    except Exception:
        pass
    return None
import re

def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    # Any symbol counts (same rule as the signup/settings checklists).
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must contain at least one special character")
