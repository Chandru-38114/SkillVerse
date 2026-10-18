"""
Supabase Storage (chat files, voice notes, avatars, session materials).

Every upload/delete goes through the helpers below. The Python SDK has
failed in odd ways on some versions, so each helper falls back to Supabase's
plain REST API before giving up.
"""
import logging
import os
from typing import Optional
from urllib.parse import urlparse

import requests
from fastapi import HTTPException
from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")


def get_supabase() -> Client:
    if not supabase_client:
        raise HTTPException(status_code=500, detail="Supabase Storage is not configured.")
    return supabase_client


def _storage_base_url() -> Optional[str]:
    """https://<project>.supabase.co (without any path), or None if not set."""
    if not SUPABASE_URL:
        return None
    parsed = urlparse(SUPABASE_URL)
    return f"{parsed.scheme}://{parsed.netloc}"


def _rest_headers(content_type: Optional[str] = None) -> dict:
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def public_url(bucket: str, path: str) -> str:
    """Public link to a file in a public bucket. Built by hand because the
    SDK's version sometimes had missing slashes or extra query params."""
    base = _storage_base_url()
    if base:
        return f"{base}/storage/v1/object/public/{bucket}/{path}"
    return get_supabase().storage.from_(bucket).get_public_url(path)


def upload_file(bucket: str, path: str, data: bytes, content_type: str) -> None:
    """Upload bytes to bucket/path. Raises HTTPException if both the SDK and
    the REST fallback fail."""
    supabase = get_supabase()
    try:
        logger.info(f"Uploading to bucket '{bucket}', path '{path}', content-type '{content_type}'")
        res = supabase.storage.from_(bucket).upload(file=data, path=path, file_options={"content-type": content_type})

        # Some SDK versions return an error dict/response instead of raising.
        if isinstance(res, dict):
            status = res.get("statusCode", res.get("status", 200))
            if res.get("error") or status >= 400:
                msg = res.get("message", res.get("error", "Upload failed"))
                logger.error(f"Storage upload dict error (Bucket: {bucket}, Path: {path}): HTTP {status} - {msg}")
                raise HTTPException(status_code=status if isinstance(status, int) else 500, detail=f"Storage upload failed (HTTP {status}): {msg}")
        elif hasattr(res, "status_code") and res.status_code >= 400:
            err = res.json() if hasattr(res, "json") else {}
            msg = err.get("message", err.get("error", "Upload failed"))
            logger.error(f"Storage upload response error (Bucket: {bucket}, Path: {path}): HTTP {res.status_code} - {msg}")
            raise HTTPException(status_code=res.status_code, detail=f"Storage upload failed (HTTP {res.status_code}): {msg}")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Storage SDK upload failed (Bucket: {bucket}, Path: {path}): {str(e)}. Attempting REST fallback...")
        _upload_via_rest(bucket, path, data, content_type)


def _upload_via_rest(bucket: str, path: str, data: bytes, content_type: str) -> None:
    base = _storage_base_url()
    if not base or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Storage configuration missing for fallback.")
    try:
        resp = requests.post(
            f"{base}/storage/v1/object/{bucket}/{path}",
            data=data, headers=_rest_headers(content_type), timeout=30,
        )
        if resp.status_code >= 400:
            err = resp.json() if resp.text else {}
            msg = err.get("message", err.get("error", resp.text or "REST Upload failed"))
            logger.error(f"REST fallback upload failed: HTTP {resp.status_code} - {msg}")
            raise HTTPException(status_code=resp.status_code, detail=f"Storage upload failed (HTTP {resp.status_code}): {msg}")
        logger.info("REST fallback upload succeeded.")
    except HTTPException:
        raise
    except Exception as rest_e:
        logger.error(f"REST fallback also failed: {str(rest_e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Both SDK and REST upload failed. Check server logs.")


def delete_file(bucket: str, path: str) -> None:
    """Delete bucket/path and make sure it's gone (a file that is already
    missing counts as deleted). Raises HTTPException if it can't be deleted."""
    supabase = get_supabase()
    logger.info(f"Attempting to remove storage object: {bucket}/{path}")

    # 1. Try the SDK
    try:
        res = supabase.storage.from_(bucket).remove([path])
        if isinstance(res, list) and len(res) > 0:
            return
        if isinstance(res, dict) and res.get("error"):
            raise Exception(res.get("message", "SDK deletion error"))
    except Exception as e:
        logger.warning(f"SDK failed to remove '{bucket}/{path}': {e}")

    # 2. The SDK didn't confirm it: try the REST API
    base = _storage_base_url()
    if not base:
        raise HTTPException(status_code=500, detail="Missing SUPABASE_URL for robust deletion.")
    try:
        resp = requests.delete(f"{base}/storage/v1/object/{bucket}/{path}", headers=_rest_headers(), timeout=30)
        if resp.status_code < 400:
            logger.info(f"REST fallback delete succeeded for '{path}'.")
            return
        err = resp.json() if resp.text else {}
        msg = err.get("message", err.get("error", resp.text or "REST Delete failed"))
        if resp.status_code == 404 or "not found" in msg.lower():
            logger.info(f"'{path}' already missing from storage.")
            return
        logger.error(f"REST fallback delete failed: HTTP {resp.status_code} - {msg}")
        raise HTTPException(status_code=resp.status_code, detail=f"Storage deletion failed (HTTP {resp.status_code}): {msg}")
    except HTTPException:
        raise
    except Exception as rest_e:
        logger.error(f"REST fallback also failed: {str(rest_e)}")
        raise HTTPException(status_code=500, detail="Storage deletion failed. Check server logs.")


def try_delete_file(bucket: str, path: str) -> None:
    """Best-effort delete: ignore any error (used for cleaning up old files)."""
    try:
        get_supabase().storage.from_(bucket).remove([path])
    except Exception as e:
        logger.warning(f"Failed to delete {bucket}/{path} from Supabase: {e}")


def signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """A temporary download link for a file in a private bucket (REST API).
    Raises HTTPException(500) if storage isn't configured, or another
    Exception if Supabase refuses."""
    base = _storage_base_url()
    if not base or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Storage configuration missing")
    resp = requests.post(
        f"{base}/storage/v1/object/sign/{bucket}/{path}",
        json={"expiresIn": expires_in}, headers=_rest_headers("application/json"), timeout=10,
    )
    if resp.status_code >= 400:
        err = resp.json() if resp.text else {}
        msg = err.get("message", err.get("error", "Signed URL generation failed"))
        raise Exception(f"HTTP {resp.status_code}: {msg}")

    # Storage usually answers {"signedURL": "/object/sign/..."}: make it a full URL.
    data = resp.json()
    signed_path = data.get("signedURL") or data.get("signedUrl")
    if not signed_path:
        raise Exception("No signed URL path in response")
    if signed_path.startswith("/storage/v1/"):
        return f"{base}{signed_path}"
    if signed_path.startswith("/object/sign/"):
        return f"{base}/storage/v1{signed_path}"
    return f"{base}/storage/v1/{signed_path.lstrip('/')}"
