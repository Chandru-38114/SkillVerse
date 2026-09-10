import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from .. import models, auth
from ..database import get_db

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
        
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (Max 10MB)")

    stored_filename = f"{uuid.uuid4()}{ext}"
    stored_path = os.path.abspath(os.path.join(UPLOAD_DIR, stored_filename))
    
    if not stored_path.startswith(os.path.abspath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="Invalid file path")

    try:
        with open(stored_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

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

    stored_path = os.path.join(UPLOAD_DIR, mat.stored_filename)
    if not os.path.exists(stored_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=stored_path,
        filename=mat.original_filename,
        media_type=mat.file_type
    )

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

    stored_path = os.path.join(UPLOAD_DIR, mat.stored_filename)
    if os.path.exists(stored_path):
        try:
            os.remove(stored_path)
        except OSError:
            pass

    db.delete(mat)
    db.commit()

    return {"detail": "Material deleted"}
