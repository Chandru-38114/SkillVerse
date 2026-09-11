import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..supabase_client import get_supabase

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserOut)
def update_me(
    req: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if req.name is not None:
        current_user.name = req.name
    if req.bio is not None:
        current_user.bio = req.bio
    if req.college is not None:
        current_user.college = req.college
    if req.country is not None:
        current_user.country = req.country
        
    if req.mobile_number is not None and req.mobile_number != current_user.mobile_number:
        # Check uniqueness
        existing = db.query(models.User).filter(models.User.mobile_number == req.mobile_number).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Mobile number already registered")
        current_user.mobile_number = req.mobile_number
        current_user.is_mobile_verified = False
        
    db.commit()
    db.refresh(current_user)
    return current_user

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
        
    supabase = get_supabase()
    
    ext = file.filename.split(".")[-1]
    filename = f"{current_user.id}_{uuid.uuid4().hex}.{ext}"
    
    # Delete old avatar if it exists
    old_url = current_user.profile_picture_url
    if old_url:
        if "supabase.co/storage/v1/object/public/avatars/" in old_url:
            old_filename = old_url.split("/")[-1]
            try:
                supabase.storage.from_("avatars").remove([old_filename])
            except Exception:
                pass
        elif old_url.startswith("/uploads/avatars/"):
            old_path = old_url.lstrip("/")
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass

    try:
        supabase.storage.from_("avatars").upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": file.content_type}
        )
        public_url = supabase.storage.from_("avatars").get_public_url(filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload avatar: {str(e)}")

    current_user.profile_picture_url = public_url
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
    # Only allow manual addition of learning skills. Teaching requires assessment.
    if req.role != "learning":
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Only learning skills can be added manually. Take an assessment to teach.")

    skill = get_or_create_skill(db, req.skill_name)
    us = db.query(models.UserSkill).filter_by(user_id=current_user.id, skill_id=skill.id, role=req.role).first()
    if not us:
        us = models.UserSkill(
            user_id=current_user.id,
            skill_id=skill.id,
            role=req.role,
            level="Unassessed"
        )
        db.add(us)
        db.commit()
        db.refresh(us)
    return schemas.UserSkillOut(
        id=us.id, skill_id=us.skill_id, skill_name=skill.name, role=us.role,
        latest_score=us.latest_score, level=us.level, badge=us.badge,
    )

@router.delete("/me/skills/{skill_id}")
def remove_skill(
    skill_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    us = db.query(models.UserSkill).filter_by(id=skill_id, user_id=current_user.id).first()
    if not us:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Skill not found")
    db.delete(us)
    db.commit()
    return {"detail": "Skill removed"}


def get_or_create_skill(db: Session, skill_name: str) -> models.Skill:
    name = skill_name.strip()
    skill = db.query(models.Skill).filter(models.Skill.name.ilike(name)).first()
    if not skill:
        skill = models.Skill(name=name)
        db.add(skill)
        db.commit()
        db.refresh(skill)
    return skill
