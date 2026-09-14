import os
import uuid
import shutil
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse, RedirectResponse

from .. import models, auth
from ..database import get_db
from ..supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/materials", tags=["materials"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "materials")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

@router.post("/{session_id}")
async def upload_material(
    session_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized to upload to this session")

    if current_user.id != session_db.tutor_id:
        raise HTTPException(status_code=403, detail="Only tutors can upload materials")

    filename = file.filename or "unnamed"
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    file_bytes = file.file.read()
    file_size = len(file_bytes)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (Max 10MB)")

    stored_filename = f"{uuid.uuid4()}{ext}"
    supabase = get_supabase()
    bucket = "materials"

    try:
        logger.info(f"Uploading to bucket '{bucket}', path '{stored_filename}', content-type '{ALLOWED_EXTENSIONS[ext]}'")
        res = supabase.storage.from_(bucket).upload(
            file=file_bytes,
            path=stored_filename,
            file_options={"content-type": ALLOWED_EXTENSIONS[ext]}
        )
        
        if isinstance(res, dict):
            status = res.get("statusCode", res.get("status", 200))
            if res.get("error") or status >= 400:
                msg = res.get("message", res.get("error", "Upload failed"))
                logger.error(f"Storage upload dict error (Bucket: {bucket}, Path: {stored_filename}): HTTP {status} - {msg}")
                raise HTTPException(status_code=status if isinstance(status, int) else 500, detail=f"Storage upload failed (HTTP {status}): {msg}")
        elif hasattr(res, "status_code") and res.status_code >= 400:
            err = res.json() if hasattr(res, "json") else {}
            msg = err.get("message", err.get("error", "Upload failed"))
            logger.error(f"Storage upload response error (Bucket: {bucket}, Path: {stored_filename}): HTTP {res.status_code} - {msg}")
            raise HTTPException(status_code=res.status_code, detail=f"Storage upload failed (HTTP {res.status_code}): {msg}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Storage SDK upload failed (Bucket: {bucket}, Path: {stored_filename}): {str(e)}. Attempting REST fallback...")
        import requests
        from ..supabase_client import SUPABASE_URL, SUPABASE_KEY
        
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Storage configuration missing for fallback.")
            
        url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{stored_filename}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": ALLOWED_EXTENSIONS[ext]
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

    mat = models.LearningMaterial(
        session_id=session_id,
        uploaded_by=current_user.id,
        title=os.path.splitext(filename)[0],
        description="",
        original_filename=filename,
        stored_filename=stored_filename,
        file_type=ALLOWED_EXTENSIONS[ext],
        file_size=file_size
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)

    return mat

@router.get("/session/{session_id}")
def list_materials(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    session_db = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")

    materials = db.query(models.LearningMaterial).filter_by(session_id=session_id).order_by(models.LearningMaterial.created_at.desc()).all()
    return materials

@router.get("/{material_id}/download")
def download_material(
    material_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    mat = db.query(models.LearningMaterial).filter_by(id=material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    session_db = db.query(models.Session).filter(models.Session.id == mat.session_id).first()
    if not session_db or current_user.id not in [session_db.tutor_id, session_db.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized")

    supabase = get_supabase()
    try:
        # Create a signed URL valid for 60 seconds
        res = supabase.storage.from_("materials").create_signed_url(mat.stored_filename, 60)
        
        # Supabase python client returns either a string or a dict depending on the exact version/method
        signed_url = res if isinstance(res, str) else res.get("signedURL") or res.get("signedUrl")
        
        if not signed_url:
            raise Exception("No signed URL returned from Supabase")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download link: {str(e)}")

    return RedirectResponse(url=signed_url, status_code=307)

@router.delete("/{material_id}")
def delete_material(
    material_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    mat = db.query(models.LearningMaterial).filter_by(id=material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    if mat.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the uploader can delete this material")

    # 1. Delete from Supabase
    supabase = get_supabase()
    try:
        supabase.storage.from_("materials").remove([mat.stored_filename])
    except Exception as e:
        print(f"Warning: Failed to delete {mat.stored_filename} from Supabase: {e}")

    # 2. Cleanup local legacy file if exists
    stored_path = os.path.join(UPLOAD_DIR, mat.stored_filename)
    if os.path.exists(stored_path):
        try:
            os.remove(stored_path)
        except OSError:
            pass

    # 3. Delete from database
    db.delete(mat)
    db.commit()

    return {"detail": "Material deleted"}
