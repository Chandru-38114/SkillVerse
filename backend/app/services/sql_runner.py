"""Run learner SQL in sql_sandbox.py: separate process, empty environment, CPU/memory limits."""
import json
import os
import subprocess
import sys

SQL_SANDBOX = os.path.join(os.path.dirname(__file__), "..", "sql_sandbox.py")


def _limits():
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))      # no files at all
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def run_sql(query: str, setup: str = "", max_rows: int = 200, timeout: float = 6.0) -> dict:
    """{"results": [...], "error": str|None}. Never raises."""
    try:
        proc = subprocess.run(
            [sys.executable, "-I", "-S", SQL_SANDBOX],
            input=json.dumps({"setup": setup or "", "query": query or "", "max_rows": max_rows}),
            capture_output=True, text=True, timeout=timeout, env={},
            preexec_fn=_limits if os.name == "posix" else None,
        )
        if proc.returncode != 0 or not proc.stdout:
            return {"results": [], "error": "The query was stopped (too slow or too much memory)."}
        return json.loads(proc.stdout)
    except subprocess.TimeoutExpired:
        return {"results": [], "error": "The query took too long and was stopped."}
    except Exception as e:  # noqa: BLE001
        return {"results": [], "error": f"Could not run the query: {e}"}
