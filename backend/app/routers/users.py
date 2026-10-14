import os
import shutil
import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..supabase_client import get_supabase
from ..services.course_rules import ensure_learning_course, get_or_create_course
from ..utils.progress_utils import progress_for

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


def calculate_age(dob) -> int:
    if not dob:
        return None
    import datetime
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

    bucket = "avatars"
    
    # Generate public URL securely and accurately to bypass Python SDK bugs (missing slashes/extra query params)
    # (No local "import os" here: it made `os` a local name for the whole
    # function and crashed the os.path.exists() call above.)
    from urllib.parse import urlparse
    env_url = os.getenv("SUPABASE_URL")
    if env_url:
        parsed = urlparse(env_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        public_url = f"{base_url}/storage/v1/object/public/{bucket}/{filename}"
    else:
        public_url = supabase.storage.from_(bucket).get_public_url(filename)

    try:
        logger.info(f"Uploading to bucket '{bucket}', path '{filename}', content-type '{file.content_type}'")
        res = supabase.storage.from_(bucket).upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": file.content_type}
        )
        
        if isinstance(res, dict):
            status = res.get("statusCode", res.get("status", 200))
            if res.get("error") or status >= 400:
                msg = res.get("message", res.get("error", "Upload failed"))
                logger.error(f"Storage upload dict error (Bucket: {bucket}, Path: {filename}): HTTP {status} - {msg}")
                raise HTTPException(status_code=status if isinstance(status, int) else 500, detail=f"Storage upload failed (HTTP {status}): {msg}")
        elif hasattr(res, "status_code") and res.status_code >= 400:
            err = res.json() if hasattr(res, "json") else {}
            msg = err.get("message", err.get("error", "Upload failed"))
            logger.error(f"Storage upload response error (Bucket: {bucket}, Path: {filename}): HTTP {res.status_code} - {msg}")
            raise HTTPException(status_code=res.status_code, detail=f"Storage upload failed (HTTP {res.status_code}): {msg}")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Storage SDK upload failed (Bucket: {bucket}, Path: {filename}): {str(e)}. Attempting REST fallback...")
        import requests
        from ..supabase_client import SUPABASE_URL, SUPABASE_KEY
        
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Storage configuration missing for fallback.")
            
        from urllib.parse import urlparse
        parsed = urlparse(SUPABASE_URL)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        url = f"{base_url}/storage/v1/object/{bucket}/{filename}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": file.content_type
        }
        
        try:
            resp = requests.post(url, data=file_bytes, headers=headers, timeout=30)
            if resp.status_code >= 400:
                err_dict = resp.json() if resp.text else {}
                msg = err_dict.get("message", err_dict.get("error", resp.text or "REST Upload failed"))
                logger.error(f"REST fallback upload failed: HTTP {resp.status_code} - {msg}")
                raise HTTPException(status_code=resp.status_code, detail=f"Storage upload failed (HTTP {resp.status_code}): {msg}")
            logger.info("REST fallback upload succeeded.")
        except HTTPException:
            raise
        except Exception as rest_e:
            logger.error(f"REST fallback also failed: {str(rest_e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Both SDK and REST upload failed. Check server logs.")

    current_user.profile_picture_url = public_url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/me/avatar", response_model=schemas.UserOut)
def remove_avatar(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    supabase = get_supabase()
    old_url = current_user.profile_picture_url
    if old_url:
        target_path = "/storage/v1/object/public/avatars/"
        if target_path in old_url:
            old_filename = old_url.split(target_path)[-1].split("?")[0]
            logger.info(f"Attempting to remove avatar object: {old_filename}")
            
            # 1. Try SDK deletion
            deleted = False
            try:
                res = supabase.storage.from_("avatars").remove([old_filename])
                if isinstance(res, list) and len(res) > 0:
                    deleted = True
                elif isinstance(res, dict) and res.get("error"):
                    raise Exception(res.get("message", "SDK deletion error"))
            except Exception as e:
                logger.warning(f"SDK failed to remove avatar '{old_filename}': {e}")
            
            # 2. If SDK didn't confirm deletion, try REST fallback
            if not deleted:
                from ..supabase_client import SUPABASE_URL, SUPABASE_KEY
                import os
                import requests
                from urllib.parse import urlparse
                
                env_url = os.getenv("SUPABASE_URL")
                if env_url:
                    parsed = urlparse(env_url)
                    base_url = f"{parsed.scheme}://{parsed.netloc}"
                    url = f"{base_url}/storage/v1/object/avatars/{old_filename}"
                    headers = {
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                    }
                    try:
                        resp = requests.delete(url, headers=headers, timeout=30)
                        if resp.status_code >= 400:
                            err_dict = resp.json() if resp.text else {}
                            msg = err_dict.get("message", err_dict.get("error", resp.text or "REST Delete failed"))
                            # If it's already missing (404/400 containing 'not found'), we consider it success
                            if resp.status_code == 404 or "not found" in msg.lower():
                                logger.info(f"Avatar '{old_filename}' already missing from storage.")
                                deleted = True
                            else:
                                logger.error(f"REST fallback delete failed: HTTP {resp.status_code} - {msg}")
                                raise HTTPException(status_code=resp.status_code, detail=f"Storage deletion failed (HTTP {resp.status_code}): {msg}")
                        else:
                            logger.info(f"REST fallback delete succeeded for '{old_filename}'.")
                            deleted = True
                    except HTTPException:
                        raise
                    except Exception as rest_e:
                        logger.error(f"REST fallback also failed: {str(rest_e)}")
                        raise HTTPException(status_code=500, detail="Storage deletion failed. Check server logs.")
                else:
                    raise HTTPException(status_code=500, detail="Missing SUPABASE_URL for robust deletion.")
                    
            if not deleted:
                raise HTTPException(status_code=500, detail="Failed to delete avatar from storage.")

        elif old_url.startswith("/uploads/avatars/"):
            old_path = old_url.lstrip("/")
            import os
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception as e:
                    logger.warning(f"Failed to remove local avatar file: {e}")

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
    us = db.query(models.UserSkill).filter_by(id=skill_id, user_id=current_user.id).first()
    if not us:
        raise HTTPException(status_code=404, detail="Skill not found")
    # A verified teaching course can't be removed: removing it and adding the
    # same course back as a learner would break "a teacher can't learn the
    # course they teach".
    if us.role == "teaching":
        raise HTTPException(status_code=400, detail="You can't remove a course you teach.")
    db.delete(us)
    db.commit()
    return {"detail": "Skill removed"}


def get_or_create_skill(db: Session, skill_name: str) -> models.Skill:
    """Validated, canonical course (see services/course_rules.py)."""
    return get_or_create_course(db, skill_name)
