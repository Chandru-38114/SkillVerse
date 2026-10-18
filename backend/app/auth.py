"""
Login security helpers: passwords, login tokens (JWT), short-lived encrypted
tokens, and "who is calling?" for REST routes and WebSockets.
"""
import base64
import datetime as dt
import hashlib
import json
import logging
import os
import re
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from . import models

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
# In production SECRET_KEY MUST be set to a strong random value
# (e.g. `openssl rand -hex 32`). The fallback is only for local development.
_DEV_SECRET = "dev-secret-change-me-before-you-launch"
SECRET_KEY = os.environ.get("SECRET_KEY", _DEV_SECRET)
if SECRET_KEY == _DEV_SECRET and not os.getenv("DATABASE_URL", "sqlite").startswith("sqlite"):
    # Production database but the public dev secret: anyone could forge a
    # login token for any user. Shout in the Render logs (not crashing, so the
    # live site keeps running until the variable is set).
    logging.getLogger("skillverse.security").critical(
        "SECRET_KEY is not set on a production database — set it on Render NOW "
        "(e.g. output of `openssl rand -hex 32`). Login tokens can be forged until then."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def validate_password_strength(password: str) -> None:
    """Raise ValueError with a friendly message if the password is too weak.
    Same rules as the signup/settings checklists in the frontend."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[^A-Za-z0-9]", password):  # any symbol counts
        raise ValueError("Password must contain at least one special character")


# ---------------------------------------------------------------------------
# Encrypted short-lived tokens (e.g. the Google sign-up step)
# ---------------------------------------------------------------------------
def get_fernet() -> Fernet:
    # Derive a 32-byte url-safe base64 key from SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest())
    return Fernet(key)


def create_encrypted_token(data: dict, expires_delta: Optional[dt.timedelta] = None) -> str:
    """Encrypt any JSON data together with an expiry time (default 15 minutes)."""
    expire = dt.datetime.utcnow() + (expires_delta or dt.timedelta(minutes=15))
    payload = {"data": data, "exp": expire.timestamp()}
    return get_fernet().encrypt(json.dumps(payload).encode()).decode()


def verify_encrypted_token(token: str) -> Optional[dict]:
    """Return the data if the token is valid and not expired, else None."""
    try:
        decrypted = get_fernet().decrypt(token.encode(), ttl=None)  # expiry is checked below
        payload = json.loads(decrypted.decode())
        if dt.datetime.utcnow().timestamp() > payload.get("exp", 0):
            return None
        return payload.get("data")
    except (InvalidToken, json.JSONDecodeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Login tokens (JWT) and "who is calling?"
# ---------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: Optional[dt.timedelta] = None) -> str:
    to_encode = data.copy()
    expire = dt.datetime.utcnow() + (expires_delta or dt.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """FastAPI dependency for REST routes: the signed-in user, or 401."""
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
    """The user id inside a login token, or None if the token is invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            return int(user_id)
    except Exception:
        pass
    return None


def get_user_from_token(token: str, db: Session) -> Optional[models.User]:
    """For WebSockets: browsers can't send an Authorization header on a
    WebSocket handshake, so the same login token comes as ?token=... .
    Returns the user, or None if the token is invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.query(models.User).filter(models.User.id == int(user_id)).first()
