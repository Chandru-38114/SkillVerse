"""Run the startup database checks by hand (the server also runs them on every start).

Usage, from the repo root:  python scripts/run_migrations.py
Uses DATABASE_URL from the environment (SQLite skillverse.db if not set).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root

import logging  # noqa: E402

from backend.app.db_migrations import run_startup_migrations  # noqa: E402

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    run_startup_migrations()
