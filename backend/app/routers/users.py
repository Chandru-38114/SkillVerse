"""
The signed-in user: profile, password, avatar, and their courses
(/users/me/skills).
"""
import datetime
import logging
import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..supabase_client import delete_file, get_supabase, public_url, try_delete_file, upload_file
from ..services.course_rules import course_count, course_in_use_problem, ensure_learning_course, get_or_create_course
from ..utils.progress_utils import progress_for

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


def calculate_age(dob) -> int:
    """Age in whole years from a date or "YYYY-MM-DD" text; None if unknown."""
    if not dob:
        return None
    try:
        if isinstance(dob, datetime.date):
            birth_date = dob
        else:
            birth_date = datetime.datetime.strptime(str(dob), "%Y-%m-%d").date()
        today = datetime.date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    except ValueError:
        return None

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    user_dict = schemas.UserOut.model_validate(current_user).model_dump()
    user_dict['age'] = calculate_age(current_user.dob)
    return user_dict

@router.put("/me", response_model=schemas.UserOut)
def update_me(
    req: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if req.name is not None:
        if not req.name.strip():
            raise HTTPException(status_code=400, detail="Name can't be empty.")
        current_user.name = req.name.strip()[:80]
    if req.bio is not None:
        current_user.bio = req.bio
    if req.college is not None:
        current_user.college = req.college
    if req.country is not None:
        current_user.country = req.country
    if req.dob is not None:
        current_user.dob = req.dob
    if req.gender is not None:
        current_user.gender = req.gender
        
    if req.mobile_number is not None:
        new_mobile = req.mobile_number if req.mobile_number.strip() != "" else None
        if new_mobile != current_user.mobile_number:
            if new_mobile is not None:
                existing = db.query(models.User).filter(models.User.mobile_number == new_mobile).first()
                if existing and existing.id != current_user.id:
                    raise HTTPException(status_code=400, detail="Mobile number already registered")
            current_user.mobile_number = new_mobile
            current_user.is_mobile_verified = False
        
    db.commit()
    db.refresh(current_user)
    user_dict = schemas.UserOut.model_validate(current_user).model_dump()
    user_dict['age'] = calculate_age(current_user.dob)
    return user_dict

@router.put("/me/password")
def change_password(
    req: schemas.PasswordChangeRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if not auth.verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    if auth.verify_password(req.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="You are entering your old password. Please choose a different password.")
        
    try:
        auth.validate_password_strength(req.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    current_user.hashed_password = auth.hash_password(req.new_password)
    db.commit()
    return {"detail": "Password updated successfully"}

AVATAR_BUCKET = "avatars"
_AVATAR_PUBLIC_PATH = "/storage/v1/object/public/avatars/"
_LOCAL_AVATAR_PREFIX = "/uploads/avatars/"  # very old avatars were stored on the server


def _remove_local_avatar(url: str) -> None:
    path = url.lstrip("/")
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception as e:
            logger.warning(f"Failed to remove local avatar file: {e}")


@router.post("/me/avatar", response_model=schemas.UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be an image.")
    file_bytes = file.file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB).")

    get_supabase()  # 500 straight away if storage is not configured
    ext = file.filename.split(".")[-1]
    filename = f"{current_user.id}_{uuid.uuid4().hex}.{ext}"

    # Delete the old avatar (best effort)
    old_url = current_user.profile_picture_url
    if old_url:
        if "supabase.co" + _AVATAR_PUBLIC_PATH in old_url:
            try_delete_file(AVATAR_BUCKET, old_url.split("/")[-1])
        elif old_url.startswith(_LOCAL_AVATAR_PREFIX):
            _remove_local_avatar(old_url)

    upload_file(AVATAR_BUCKET, filename, file_bytes, file.content_type)

    current_user.profile_picture_url = public_url(AVATAR_BUCKET, filename)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=schemas.UserOut)
def remove_avatar(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    get_supabase()  # 500 straight away if storage is not configured
    old_url = current_user.profile_picture_url
    if old_url:
        if _AVATAR_PUBLIC_PATH in old_url:
            old_filename = old_url.split(_AVATAR_PUBLIC_PATH)[-1].split("?")[0]
            delete_file(AVATAR_BUCKET, old_filename)  # raises if it can't be deleted
        elif old_url.startswith(_LOCAL_AVATAR_PREFIX):
            _remove_local_avatar(old_url)

    current_user.profile_picture_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/skills", response_model=List[schemas.UserSkillOut])
def get_my_skills(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(models.UserSkill).filter(models.UserSkill.user_id == current_user.id).all()
    return [
        schemas.UserSkillOut(
            id=r.id, skill_id=r.skill_id, skill_name=r.skill.name, role=r.role,
            latest_score=r.latest_score, level=r.level, badge=r.badge,
            sessions_completed=r.sessions_completed or 0,
            # Computed from the current rule, so rows saved under the old
            # rule (badge = 100%) show the right value too.
            progress_percentage=progress_for(r),
        )
        for r in rows
    ]

from pydantic import BaseModel
class SkillAddRequest(BaseModel):
    skill_name: str
    role: str = "learning"

@router.post("/me/skills", response_model=schemas.UserSkillOut)
def add_skill(
    req: SkillAddRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    # Only learning courses can be added by hand. Teaching needs the Skill Arena.
    if req.role != "learning":
        raise HTTPException(status_code=400, detail="Only learning courses can be added manually. Pass the Skill Arena to teach.")

    skill = get_or_create_skill(db, req.skill_name)
    # Refuses a course you teach and a 5th course (services/course_rules.py).
    us = ensure_learning_course(db, current_user.id, skill)
    db.commit()
    db.refresh(us)
    return schemas.UserSkillOut(
        id=us.id, skill_id=us.skill_id, skill_name=skill.name, role=us.role,
        latest_score=us.latest_score, level=us.level, badge=us.badge,
        sessions_completed=us.sessions_completed or 0, progress_percentage=progress_for(us),
    )

@router.delete("/me/skills/{skill_id}")
def remove_skill(
    skill_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Remove one of my courses (learning or teaching) to free one of the 4
    slots. `skill_id` is the id of my row in /users/me/skills. Past history
    (attempts, sessions, certificates) is kept."""
    us = db.query(models.UserSkill).filter_by(id=skill_id, user_id=current_user.id).first()
    if not us:
        raise HTTPException(status_code=404, detail="Skill not found")
    problem = course_in_use_problem(db, current_user.id, us.skill)
    if problem:
        raise HTTPException(status_code=409, detail=problem)
    name = us.skill.name
    # Old data can hold two rows (teaching + learning) for one course: remove both.
    db.query(models.UserSkill).filter_by(user_id=current_user.id, skill_id=us.skill_id).delete()
    db.commit()
    return {"detail": f"{name} was removed from your courses.", "courses_left": course_count(db, current_user.id)}


def get_or_create_skill(db: Session, skill_name: str) -> models.Skill:
    """Validated, canonical course (see services/course_rules.py)."""
    return get_or_create_course(db, skill_name)
