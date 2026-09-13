from backend.app import models, schemas
from backend.app.routers.chat import upload_attachment
from backend.app.routers.sessions import create_session
from fastapi import UploadFile, HTTPException
import io
import asyncio
from unittest.mock import MagicMock

class MockUser:
    id = 1

class MockDB:
    def query(self, *args, **kwargs):
        class MockQuery:
            def filter(self, *args, **kwargs):
                return self
            def filter_by(self, *args, **kwargs):
                return self
            def first(self, *args, **kwargs):
                req = models.ConnectionRequest(id=1, sender_id=1, receiver_id=2, status="accepted")
                return req
        return MockQuery()

async def test():
    db = MockDB()
    user = MockUser()
    
    # Test valid upload
    print("Testing valid upload...")
    file_bytes = b"PDF content"
    file = UploadFile(filename="test.pdf", file=io.BytesIO(file_bytes))
    file.size = len(file_bytes)
    
    # Mocking get_supabase to prevent actual network calls
    import backend.app.routers.chat as chat_router
    chat_router.get_supabase = MagicMock()
    
    try:
        res = await upload_attachment(request_id=1, file=file, current_user=user, db=db)
        print("Valid Upload Success:", res)
    except Exception as e:
        print("Valid Upload Failed:", e)
        
    # Test large upload
    print("\nTesting large upload...")
    large_bytes = b"0" * (6 * 1024 * 1024)
    large_file = UploadFile(filename="large.pdf", file=io.BytesIO(large_bytes))
    large_file.size = len(large_bytes)
    try:
        await upload_attachment(request_id=1, file=large_file, current_user=user, db=db)
        print("Large Upload should have failed but didn't.")
    except HTTPException as e:
        print("Large Upload Caught:", e.detail)

    # Test invalid type
    print("\nTesting invalid type...")
    invalid_file = UploadFile(filename="script.js", file=io.BytesIO(b"alert(1)"))
    invalid_file.size = 10
    try:
        await upload_attachment(request_id=1, file=invalid_file, current_user=user, db=db)
        print("Invalid Type should have failed but didn't.")
    except HTTPException as e:
        print("Invalid Type Caught:", e.detail)

asyncio.run(test())
