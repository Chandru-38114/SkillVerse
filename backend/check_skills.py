import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))
from app.database import SessionLocal
from app.models import Skill
db = SessionLocal()
skills = db.query(Skill).all()
for s in skills: print(s.name)
db.close()
