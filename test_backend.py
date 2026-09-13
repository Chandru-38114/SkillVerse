from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import models
from backend.app.database import SessionLocal, engine
from io import BytesIO

client = TestClient(app)

# 1. We need a token
# Assuming test accounts exist in the DB
db = SessionLocal()
user1 = db.query(models.User).filter_by(email="test@example.com").first()

if not user1:
    print("Test user not found, skipping backend test")
else:
    # Get token for user1
    response = client.post("/auth/login", data={"username": "test@example.com", "password": "password"})
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Token obtained")
    
    # 2. Upload file
    # We need a connection request
    req = db.query(models.ConnectionRequest).filter(
        (models.ConnectionRequest.sender_id == user1.id) | (models.ConnectionRequest.receiver_id == user1.id)
    ).first()
    
    if req:
        print(f"Testing chat upload for request_id: {req.id}")
        file_content = b"Fake PDF content"
        files = {"file": ("test_doc.pdf", file_content, "application/pdf")}
        response = client.post(f"/chat/{req.id}/upload", headers=headers, files=files)
        print("Upload Response:", response.status_code, response.json())
        
        # Test large file
        large_file = b"0" * (6 * 1024 * 1024)
        files = {"file": ("large.pdf", large_file, "application/pdf")}
        response = client.post(f"/chat/{req.id}/upload", headers=headers, files=files)
        print("Large File Response:", response.status_code, response.json())
        
        # Test invalid type
        files = {"file": ("script.js", b"alert(1)", "application/javascript")}
        response = client.post(f"/chat/{req.id}/upload", headers=headers, files=files)
        print("Invalid Type Response:", response.status_code, response.json())
        
        # 3. Scheduling
        schedule_data = {
            "request_id": req.id,
            "session_date": "2026-09-20",
            "start_time": "10:00",
            "end_time": "11:00",
            "notes": "Testing schedule from chat"
        }
        response = client.post("/sessions", headers=headers, json=schedule_data)
        print("Schedule Response:", response.status_code, response.json())
    else:
        print("No connection request found for testing")

db.close()
