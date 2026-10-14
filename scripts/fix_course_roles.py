"""Clean up old data so every user has ONE role per course (see
backend/app/services/course_rules.py). Before this rule existed, a user could
hold the same course twice: once as "teaching" and once as "learning".

For each such pair the TEACHING row is kept (a teacher can't be a learner of
the same course) and the learning row is removed. Nothing else is changed.

Run from the repo root:
    python scripts/fix_course_roles.py          (shows what it would do)
    python scripts/fix_course_roles.py --apply  (really does it)
Uses DATABASE_URL from the environment (or the local SQLite database)."""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root

from backend.app.database import SessionLocal  # noqa: E402
from backend.app import models  # noqa: E402


def main():
    apply = "--apply" in sys.argv
    db = SessionLocal()
    try:
        groups = defaultdict(list)
        for us in db.query(models.UserSkill).all():
            groups[(us.user_id, us.skill_id)].append(us)

        to_delete = []
        for (user_id, skill_id), rows in groups.items():
            if len(rows) < 2:
                continue
            teaching = [r for r in rows if r.role == "teaching"]
            keep = teaching[0] if teaching else rows[0]
            for r in rows:
                if r is not keep:
                    to_delete.append(r)
                    print(f"user {user_id}, course {skill_id}: keep row {keep.id} ({keep.role}), remove row {r.id} ({r.role})")

        if not to_delete:
            print("Nothing to fix: every user has one role per course.")
            return
        if not apply:
            print(f"{len(to_delete)} row(s) would be removed. Run again with --apply to do it.")
            return
        for r in to_delete:
            db.delete(r)
        db.commit()
        print(f"Removed {len(to_delete)} duplicate row(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
