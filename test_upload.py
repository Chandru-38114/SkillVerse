import asyncio
from backend.app.supabase_client import get_supabase

def main():
    supabase = get_supabase()
    print("Supabase client initialized.")
    try:
        res = supabase.storage.from_("chat_audio").upload(
            file=b"test",
            path="test.txt",
            file_options={"content-type": "text/plain"}
        )
        print("Upload result type:", type(res))
        print("Upload result:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

main()
