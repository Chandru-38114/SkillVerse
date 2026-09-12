import os
import re

with open('backend/app/routers/materials.py', 'r', encoding='utf-8') as f:
    code = f.read()

if 'from fastapi.responses import FileResponse, RedirectResponse' not in code:
    code = code.replace('from fastapi.responses import FileResponse', 'from fastapi.responses import FileResponse, RedirectResponse')

if 'from ..supabase_client import get_supabase' not in code:
    code = code.replace('from ..database import get_db', 'from ..database import get_db\nfrom ..supabase_client import get_supabase')

# Replace upload_material
upload_func = '''@router.post("/{session_id}")
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

    try:
        supabase.storage.from_("materials").upload(
            file=file_bytes,
            path=stored_filename,
            file_options={"content-type": ALLOWED_EXTENSIONS[ext]}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file to Supabase: {str(e)}")

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

    return mat'''
code = re.sub(
    r'@router\.post\("/\{session_id\}"\)\nasync def upload_material\(.*?(?=@router\.get\("/session/\{session_id\}"\))',
    upload_func + '\n\n',
    code,
    flags=re.DOTALL
)

# Replace download_material
download_func = '''@router.get("/{material_id}/download")
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

    return RedirectResponse(url=signed_url, status_code=307)'''
code = re.sub(
    r'@router\.get\("/\{material_id\}/download"\)\ndef download_material\(.*?(?=@router\.delete\("/\{material_id\}"\))',
    download_func + '\n\n',
    code,
    flags=re.DOTALL
)

# Replace delete_material
delete_func = '''@router.delete("/{material_id}")
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

    return {"detail": "Material deleted"}'''
code = re.sub(
    r'@router\.delete\("/\{material_id\}"\)\ndef delete_material\(.*',
    delete_func + '\n',
    code,
    flags=re.DOTALL
)

with open('backend/app/routers/materials.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("materials.py patched")
