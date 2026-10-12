import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.app.supabase_client import get_supabase

def create_buckets():
    try:
        sb = get_supabase()
        existing = [b.name for b in sb.storage.list_buckets()]
        
        for bucket in ["chat_audio", "chat_files"]:
            if bucket not in existing:
                print(f"Creating bucket {bucket}...")
                sb.storage.create_bucket(bucket, {"public": False})
                print(f"Bucket {bucket} created.")
            else:
                print(f"Bucket {bucket} already exists.")
    except Exception as e:
        print("Could not verify/create buckets:", e)

if __name__ == "__main__":
    create_buckets()
