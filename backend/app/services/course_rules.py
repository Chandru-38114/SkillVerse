"""
Course rules — ONE place for "who may do what in which course".

SkillVerse is level-based learning. The rules (agreed with the team):

1. A user has ONE role per course: "teaching" or "learning", never both.
   - A teacher of a course can never be a learner of the same course.
   - A learner can grow into a teacher: pass the Skill Arena with the
     "teach" goal and a score of at least TEACH_MIN_SCORE. The course then
     moves from learning to teaching.
2. A user can have at most MAX_COURSES courses in total (teaching + learning).
   Any course name is allowed (the AI writes the questions), as long as the
   name looks like a real course name.
3. A learner may only send a request to someone who TEACHES that course and
   is at least two levels above them (utils.levels.is_eligible_to_teach).
4. A course is finished (100%) when the learner has completed
   SESSIONS_FOR_FINAL sessions AND then passed the final Skill Arena with at
   least FINAL_PASS_SCORE. Only then can a certificate be issued.
"""
import re
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..utils.levels import is_eligible_to_teach
from .question_generator import canonical_skill

MAX_COURSES = 4
TEACH_MIN_SCORE = 60          # Arena score needed to become a teacher of a course
FINAL_PASS_SCORE = 60         # final Arena score needed to finish a course
SESSIONS_FOR_FINAL = 5        # completed sessions before the final challenge counts
PERCENT_PER_SESSION = 16      # 5 sessions = 80%; passing the final = 100%

# Letters, digits, spaces and a few symbols used in course names
# (C++, C#, Node.js, UI/UX, Data-Science, "Python (Basics)").
_COURSE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 +#./&()'-]{0,48}[A-Za-z0-9+#)]?$")


def clean_course_name(raw: Optional[str]) -> str:
    """Return the canonical course name or raise 400 for an unusable one.
    Known courses map to their canonical names (dsa -> Data Structures and
    Algorithms); anything else is kept as typed, with extra spaces removed."""
    name = " ".join((raw or "").split())
    if len(name) < 1 or len(name) > 50 or not _COURSE_NAME_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid course name (letters, numbers and + # . / & - only, up to 50 characters).",
        )
    return canonical_skill(name)


def find_course(db: Session, name: str) -> Optional[models.Skill]:
    """Case-insensitive exact match (no LIKE wildcards from user input)."""
    from sqlalchemy import func
    return db.query(models.Skill).filter(func.lower(models.Skill.name) == name.lower()).first()


def get_or_create_course(db: Session, raw_name: str) -> models.Skill:
    name = clean_course_name(raw_name)
    skill = find_course(db, name)
    if not skill:
        skill = models.Skill(name=name)
        db.add(skill)
        db.commit()
        db.refresh(skill)
    return skill


def user_course(db: Session, user_id: int, skill_id: int) -> Optional[models.UserSkill]:
    """The user's row for this course. Old data may still hold two rows (one
    teaching, one learning); the teaching row wins, matching rule 1."""
    rows = (
        db.query(models.UserSkill)
        .filter(models.UserSkill.user_id == user_id, models.UserSkill.skill_id == skill_id)
        .all()
    )
    if not rows:
        return None
    teaching = [r for r in rows if r.role == "teaching"]
    return teaching[0] if teaching else rows[0]


def course_count(db: Session, user_id: int) -> int:
    return (
        db.query(models.UserSkill.skill_id)
        .filter(models.UserSkill.user_id == user_id)
        .distinct()
        .count()
    )


def ensure_can_add_course(db: Session, user_id: int) -> None:
    if course_count(db, user_id) >= MAX_COURSES:
        raise HTTPException(
            status_code=409,
            detail=f"You can have at most {MAX_COURSES} courses. Finish or remove one before adding another.",
        )


def ensure_learning_course(db: Session, user_id: int, skill: models.Skill) -> models.UserSkill:
    """Make sure the user is a LEARNER of this course, adding it if needed.
    Refuses if they teach it (rule 1) or already have MAX_COURSES (rule 2)."""
    us = user_course(db, user_id, skill.id)
    if us and us.role == "teaching":
        raise HTTPException(
            status_code=403,
            detail=f"You teach {skill.name}, so you can't join it as a learner.",
        )
    if us:
        return us
    ensure_can_add_course(db, user_id)
    us = models.UserSkill(user_id=user_id, skill_id=skill.id, role="learning", level="Unassessed", level_num=0)
    db.add(us)
    db.flush()
    return us


def teaching_problem(db: Session, teacher_id: int, learner_id: int, skill_id: int) -> Optional[str]:
    """None if teacher_id may teach learner_id this course, else the reason.
    Checks roles (teacher teaches it, learner doesn't) and levels."""
    if teacher_id == learner_id:
        return "You can't connect with yourself."
    t = user_course(db, teacher_id, skill_id)
    if not t or t.role != "teaching":
        return "This person doesn't teach this course."
    l = user_course(db, learner_id, skill_id)
    if l and l.role == "teaching":
        return "The learner already teaches this course."
    t_lvl = t.level_num or 0
    l_lvl = (l.level_num or 0) if l else 0
    if not is_eligible_to_teach(t_lvl, l_lvl):
        return "The tutor must be at least two levels above the learner in this course."
    return None


def is_course_finished(us: Optional[models.UserSkill]) -> bool:
    return bool(us and us.role == "learning" and us.course_completed_at is not None)
