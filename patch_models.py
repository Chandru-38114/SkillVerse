import datetime as dt

with open("backend/app/models.py", "r", encoding="utf-8") as f:
    content = f.read()

age_prop = """
    @property
    def age(self):
        if self.dob:
            today = dt.date.today()
            return today.year - self.dob.year - ((today.month, today.day) < (self.dob.month, self.dob.day))
        return None
"""
content = content.replace("user_skills = relationship(\"UserSkill\", back_populates=\"user\", cascade=\"all, delete-orphan\")", age_prop + "\n    user_skills = relationship(\"UserSkill\", back_populates=\"user\", cascade=\"all, delete-orphan\")")

with open("backend/app/models.py", "w", encoding="utf-8") as f:
    f.write(content)
