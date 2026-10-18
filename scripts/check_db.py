"""Print how many rows each main table has (quick health check).

Usage, from the repo root:  python scripts/check_db.py
Uses DATABASE_URL from the environment (SQLite skillverse.db if not set).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root

from backend.app.database import SessionLocal, engine  # noqa: E402
from backend.app import models  # noqa: E402

db = SessionLocal()

tables = [
    ("User", models.User),
    ("EmailVerificationOTP", models.EmailVerificationOTP),
    ("MobileVerificationOTP", models.MobileVerificationOTP),
    ("PasswordResetOTP", models.PasswordResetOTP),
    ("Skill", models.Skill),
    ("UserSkill", models.UserSkill),
    ("AssessmentAttempt", models.AssessmentAttempt),
    ("ConnectionRequest", models.ConnectionRequest),
    ("Message", models.Message),
    ("Review", models.Review),
    ("Session", models.Session),
    ("WhiteboardState", models.WhiteboardState),
    ("CompilerState", models.CompilerState),
    ("LearningMaterial", models.LearningMaterial),
    ("SessionProgress", models.SessionProgress),
    ("Certificate", models.Certificate),
    ("Notification", models.Notification)
]

print(f"Database dialect: {engine.dialect.name}")
print(f"Database file: {engine.url.database}")

for name, model in tables:
    try:
        count = db.query(model).count()
        print(f"{name}: {count}")
    except Exception as e:
        print(f"{name}: Error - {e}")

db.close()
