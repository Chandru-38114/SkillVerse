"""Shared bootstrap + PASS/FAIL reporting for the eval/ scripts.

Not application code: nothing under backend/ or frontend/ imports this. Each
eval script calls setup_backend_env() before importing anything from `app`,
so imports never touch a real database or the real Gemini API.
"""
import os
import sys
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
TMP_DIR = REPO_ROOT / "eval" / "tmp"


def setup_backend_env(db_name: str) -> pathlib.Path:
    """Point DATABASE_URL at a throwaway SQLite file, set a dummy SECRET_KEY
    and GEMINI_API_KEY, and put backend/ on sys.path. Never touches the real
    database or the real Gemini API."""
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    db_path = TMP_DIR / db_name
    if db_path.exists():
        db_path.unlink()

    env = {
        "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
        "SECRET_KEY": "eval-harness-secret-not-for-production",
        "GEMINI_API_KEY": "eval-harness-dummy-key-never-sent-to-gemini",
    }
    os.environ.update(env)
    # Importing `app` runs app/__init__.py -> config.load_env(), which copies
    # backend/.env into os.environ and could clobber the values above if that
    # file ever defines them. Re-assert afterwards so this script never talks
    # to a real database or a real GEMINI_API_KEY regardless of .env contents.
    import app  # noqa: F401
    os.environ.update(env)
    return db_path


class Report:
    def __init__(self, title: str):
        self.title = title
        self.results = []
        print(f"=== {title} ===")

    def check(self, name: str, condition: bool, info: str = "") -> bool:
        status = "PASS" if condition else "FAIL"
        suffix = f" -- {info}" if info else ""
        print(f"[{status}] {name}{suffix}")
        self.results.append((name, bool(condition)))
        return bool(condition)

    def summary(self) -> bool:
        total = len(self.results)
        passed = sum(1 for _, ok in self.results if ok)
        failed = total - passed
        print(f"\n{self.title}: {passed}/{total} PASSED")
        if failed:
            print(f"{failed} FAILED — investigate before citing these numbers in the paper:")
            for name, ok in self.results:
                if not ok:
                    print(f"  - {name}")
        return failed == 0
