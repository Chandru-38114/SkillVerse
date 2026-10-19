"""
One place that runs learner code in any SkillVerse language.

  python      -> our own sandbox (services/code_runner.py + sandbox.py), on this server
  sql         -> in-memory SQLite sandbox (services/sql_runner.py), on this server
  java        -> the separate code runner service (runner/), via RUNNER_URL + RUNNER_TOKEN
  javascript  -> the same runner (Node)
  (HTML/CSS run in the learner's own browser, in a sealed preview frame: no server.)

Java and JavaScript never run on this server, because this server holds the
database password and API keys. The runner holds none of them.
"""
import os
import re
import threading
import time

import requests

from .code_runner import run_python
from .sql_runner import run_sql

LANGUAGES = ("python", "java", "javascript", "sql")
RUNNER_URL = os.environ.get("RUNNER_URL", "").rstrip("/")
RUNNER_TOKEN = os.environ.get("RUNNER_TOKEN", "")
RUNNER_TIMEOUT = float(os.environ.get("RUNNER_HTTP_TIMEOUT", "75"))  # a sleeping free runner needs ~1 min to wake


def runner_configured() -> bool:
    return bool(RUNNER_URL and RUNNER_TOKEN)


_last_warm = {"t": 0.0}


def prewarm_runner() -> None:
    """Wake a sleeping runner in the background (at most once every 5 minutes)."""
    if not runner_configured() or time.monotonic() - _last_warm["t"] < 300:
        return
    _last_warm["t"] = time.monotonic()

    def ping():
        try:
            requests.get(f"{RUNNER_URL}/health", timeout=RUNNER_TIMEOUT)
        except requests.RequestException:
            pass
    threading.Thread(target=ping, daemon=True).start()


def call_runner(language: str, files: dict, entry: str, stdin: str = "", time_limit: float = 5.0) -> dict:
    """POST to the runner. Always returns a dict with a 'status'."""
    if not runner_configured():
        return {"status": "unavailable", "stdout": "", "stderr": "", "compile_output": "", "time_ms": 0,
                "message": "Java and JavaScript need the SkillVerse code runner, which isn't set up yet (RUNNER_URL)."}
    try:
        r = requests.post(
            f"{RUNNER_URL}/run",
            json={"language": language, "files": files, "entry": entry, "stdin": stdin or "", "time_limit": time_limit},
            headers={"X-Runner-Token": RUNNER_TOKEN}, timeout=RUNNER_TIMEOUT,
        )
        if r.status_code != 200:
            return {"status": "unavailable", "stdout": "", "stderr": "", "compile_output": "", "time_ms": 0,
                    "message": f"The code runner answered {r.status_code}."}
        return r.json()
    except requests.RequestException:
        return {"status": "unavailable", "stdout": "", "stderr": "", "compile_output": "", "time_ms": 0,
                "message": "The code runner is waking up or unreachable. Try again in a minute."}


_PUBLIC_CLASS = re.compile(r"public\s+(?:final\s+)?class\s+([A-Za-z_]\w*)")
_ANY_MAIN_CLASS = re.compile(r"class\s+([A-Za-z_]\w*)[^{]*\{(?:(?!\bclass\b).)*?static\s+void\s+main\s*\(", re.S)


def java_main_class(code: str) -> str:
    """The class to run: the public class if there is one, else the class with main()."""
    m = _PUBLIC_CLASS.search(code)
    if m:
        return m.group(1)
    m = _ANY_MAIN_CLASS.search(code)
    return m.group(1) if m else "Main"


def run_program(language: str, code: str, stdin: str = "") -> dict:
    """Run a whole program (the Learning Arena / Practice "Run" button with custom input).

    Returns {"status": ok|compile_error|runtime_error|timeout|unavailable|busy,
             "output": str, "error": str|None, "sql": [...]|None, "time_ms": int}."""
    language = (language or "python").lower()
    if language == "python":
        r = run_python(code, timeout=6.0, stdin=stdin)
        err = r.get("error")
        status = "ok" if not err else ("timeout" if "time limit" in err.lower() else "runtime_error")
        return {"status": status, "output": r.get("output", ""), "error": err, "sql": None, "time_ms": None}
    if language == "sql":
        r = run_sql(code)
        return {"status": "runtime_error" if r.get("error") else "ok", "output": "", "error": r.get("error"),
                "sql": r.get("results", []), "time_ms": None}
    if language == "java":
        main = java_main_class(code)
        r = call_runner("java", {f"{main}.java": code}, main, stdin)
    elif language == "javascript":
        r = call_runner("javascript", {"main.js": code}, "main.js", stdin)
    else:
        return {"status": "unavailable", "output": "", "error": f"{language} can't be run here.", "sql": None, "time_ms": None}
    return _from_runner(r)


def _from_runner(r: dict) -> dict:
    status = r.get("status", "unavailable")
    if status == "compile_error":
        error = r.get("compile_output") or "Compilation failed."
    elif status == "timeout":
        error = "Time limit exceeded: the program ran too long (infinite loop?)."
    elif status in ("unavailable", "busy"):
        error = r.get("message") or "The code runner is not available."
    else:
        error = r.get("stderr") or None
    return {"status": status, "output": r.get("stdout", ""), "error": error if status != "ok" or error else None,
            "sql": None, "time_ms": r.get("time_ms")}
