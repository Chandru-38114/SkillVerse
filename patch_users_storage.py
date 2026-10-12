import os
import re

with open('backend/app/routers/users.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import
if 'from ..supabase_client import get_supabase' not in code:
    code = code.replace('from ..database import get_db', 'from ..database import get_db\nfrom ..supabase_client import get_supabase')

# Replace upload_avatar function
new_func = '''@router.post("/me/avatar", response_model=schemas.UserOut)
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
    return current_user'''

# Regex to replace the function
code = re.sub(
    r'@router\.post\("/me/avatar", response_model=schemas\.UserOut\)\ndef upload_avatar\(.*?(?=@router\.get\("/me/skills")',
    new_func + '\n\n',
    code,
    flags=re.DOTALL
)

with open('backend/app/routers/users.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("users.py patched")
