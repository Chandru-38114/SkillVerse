import os
import sys
import logging

# Change to backend directory
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.database import engine, Base, SessionLocal
from app import models
from sqlalchemy import inspect, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_users_local_db():
    db = SessionLocal()
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    # We delete from dependent tables first
    tables_to_delete = [
        "certificates",
        "notifications",
        "session_progress",
        "learning_materials",
        "compiler_states",
        "whiteboard_states",
        "sessions",
        "reviews",
        "message_user_states",
        "messages",
        "connection_requests",
        "assessment_attempts",
        "user_skills",
        "password_reset_otps",
        "email_verification_otps",
        "mobile_verification_otps",
        "users"
    ]
    
    try:
        # Since sqlite doesn't enforce foreign keys by default, we can just delete from all of them
        for table in tables_to_delete:
            if table in existing_tables:
                db.execute(text(f"DELETE FROM {table}"))
                logger.info(f"Deleted all records from {table}")
        
        db.commit()
        logger.info("Successfully deleted all user data from local SQLite database.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting from local DB: {e}")
    finally:
        db.close()

def reset_users_supabase():
    try:
        from app.supabase_client import get_supabase
        supabase = get_supabase()
        if not supabase:
            logger.warning("Supabase client not initialized. Skipping Supabase reset.")
            return

        # Attempt to delete all users from Auth (requires service role key)
        try:
            users_res = supabase.auth.admin.list_users()
            for u in users_res.users:
                supabase.auth.admin.delete_user(u.id)
            logger.info("Successfully deleted users from Supabase Auth.")
        except Exception as auth_e:
            logger.warning(f"Failed to delete Supabase Auth users (requires Service Role Key): {auth_e}")

        # Emptying storage buckets
        try:
            for bucket in ["avatars", "materials", "certificates"]:
                try:
                    res = supabase.storage.from_(bucket).list()
                    if res:
                        files = [f['name'] for f in res if f['name'] != '.emptyFolderPlaceholder']
                        if files:
                            supabase.storage.from_(bucket).remove(files)
                    logger.info(f"Successfully cleaned up Supabase '{bucket}' bucket.")
                except Exception as b_e:
                    pass
        except Exception as storage_e:
            logger.warning(f"Failed to clean up Supabase storage: {storage_e}")
            
    except Exception as e:
        logger.warning(f"Supabase not accessible or an error occurred: {e}")

if __name__ == "__main__":
    logger.info("Starting fresh user reset...")
    reset_users_local_db()
    # Supabase might not be accessible if package missing, try gracefully
    try:
        import supabase
        reset_users_supabase()
    except ImportError:
        logger.warning("Supabase package not installed, skipping Supabase reset.")
    logger.info("Reset complete.")
