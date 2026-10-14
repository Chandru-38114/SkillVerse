"""Award computable teacher badges to every existing user (run once after
adding new badge rules). Run from the repo root:  python scripts/award_badges.py
Uses DATABASE_URL from the environment (or the local SQLite database)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root

from backend.app.database import SessionLocal  # noqa: E402
from backend.app.services.badge_service import award_badges_retroactively  # noqa: E402


def main():
    db = SessionLocal()
    try:
        awarded = award_badges_retroactively(db)
        print(f"Evaluated badges for {len(awarded)} qualified users.")
        for user_id, badges in awarded.items():
            print(f"  user {user_id}: {', '.join(badges)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
