import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.database import SessionLocal, engine
from app import models

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
        print(f"{name}: Error")

db.close()
