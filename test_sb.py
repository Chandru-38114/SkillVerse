import os
from backend.app.supabase_client import get_supabase
try:
    sb = get_supabase()
    print("Supabase connected")
except Exception as e:
    print("Error:", e)
