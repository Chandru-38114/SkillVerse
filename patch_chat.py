import re

with open('backend/app/routers/chat.py', 'r', encoding='utf-8') as f:
    content = f.read()

endpoints = """
import uuid
import mimetypes
from fastapi import UploadFile, File
from fastapi.responses import RedirectResponse
from ..database import get_supabase

ALLOWED_EXTENSIONS = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "txt": "text/plain",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

@router.post("/{request_id}/upload")
async def upload_attachment(
    request_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    filename = f"chat_{request_id}_{uuid.uuid4().hex}_{file.filename}"
    supabase = get_supabase()

    try:
        supabase.storage.from_("materials").upload(
            file=file_bytes,
            path=filename,
            file_options={"content-type": ALLOWED_EXTENSIONS[ext]}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

    # We return a standard markdown string that the frontend can insert into the chat
    url = f"/api/chat/{request_id}/attachment/{filename}"
    
    if ext in ["png", "jpg", "jpeg"]:
        md = f"![{file.filename}]({url})"
    else:
        md = f"[{file.filename}]({url})"
        
    return {"markdown": md, "url": url, "filename": file.filename}


@router.get("/{request_id}/attachment/{filename}")
def download_attachment(
    request_id: int,
    filename: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    _authorize(db, request_id, current_user.id)
    
    supabase = get_supabase()
    try:
        res = supabase.storage.from_("materials").create_signed_url(filename, 3600)
        signed_url = res if isinstance(res, str) else res.get("signedURL") or res.get("signedUrl")
        if not signed_url:
            raise Exception("No signed URL returned")
        return RedirectResponse(url=signed_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not generate download link")
"""

content = content.replace("router = APIRouter(prefix=\"/chat\", tags=[\"chat\"])", "router = APIRouter(prefix=\"/chat\", tags=[\"chat\"])\n\n" + endpoints)

with open('backend/app/routers/chat.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
