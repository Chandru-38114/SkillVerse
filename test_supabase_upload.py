
from backend.app.supabase_client import get_supabase
import uuid

def main():
    try:
        supabase = get_supabase()
        res = supabase.storage.from_("chat_audio").upload(
            file=b"test_content",
            path=f"test_{uuid.uuid4().hex}.webm",
            file_options={"content-type": "audio/webm"}
        )
        print("Upload successful:", type(res), res)
    except Exception as e:
        print("Upload failed exception:", type(e), str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

