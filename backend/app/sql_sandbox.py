"""
Runs a learner's SQL in a throw-away in-memory SQLite database (child process).

Reads JSON from stdin: {"setup": "<CREATE/INSERT script>", "query": "<learner SQL>", "max_rows": 200}
Prints JSON: {"results": [{"columns": [...], "rows": [[...]]} | {"message": "3 rows changed"}], "error": null}

Locks: the database lives only in memory; ATTACH/DETACH (which could open files),
every PRAGMA, extension loading and virtual tables are refused by an authorizer;
a progress handler stops runaway queries. services/sql_runner.py adds an empty
environment and CPU/memory limits around this process.
"""
import json
import sqlite3
import sys

MAX_STEPS = 20_000_000          # SQLite VM instructions before we give up
MAX_CELL_CHARS = 500


def _authorizer(action, arg1, arg2, dbname, source):
    if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_PRAGMA):
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_FUNCTION and (arg2 or "").lower() in ("load_extension", "readfile", "writefile", "edit", "fts3_tokenizer"):
        return sqlite3.SQLITE_DENY
    if action in (getattr(sqlite3, "SQLITE_CREATE_VTABLE", -1), getattr(sqlite3, "SQLITE_DROP_VTABLE", -1)):
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def _statements(script: str):
    """Split a script into complete statements (a ';' inside a string doesn't split)."""
    start = 0
    for i, ch in enumerate(script):
        if ch == ";" and sqlite3.complete_statement(script[start:i + 1]):
            stmt = script[start:i + 1].strip()
            if stmt.strip(";").strip():
                yield stmt
            start = i + 1
    rest = script[start:].strip()
    if rest.strip(";").strip():
        yield rest


def _cell(v):
    if isinstance(v, bytes):
        return v.hex()
    if isinstance(v, str) and len(v) > MAX_CELL_CHARS:
        return v[:MAX_CELL_CHARS] + "…"
    return v


def main():
    req = json.loads(sys.stdin.read() or "{}")
    max_rows = int(req.get("max_rows", 200))
    conn = sqlite3.connect(":memory:", isolation_level=None)
    conn.execute("PRAGMA temp_store = MEMORY")      # before the authorizer: no temp files
    conn.set_authorizer(_authorizer)
    steps = {"n": 0}

    def progress():
        steps["n"] += 1000
        return 1 if steps["n"] > MAX_STEPS else 0   # non-zero = interrupt
    conn.set_progress_handler(progress, 1000)

    out = {"results": [], "error": None}
    try:
        if req.get("setup"):
            for stmt in _statements(req["setup"]):
                conn.execute(stmt)
        for stmt in _statements(req.get("query") or ""):
            cur = conn.execute(stmt)
            if cur.description:
                rows = cur.fetchmany(max_rows + 1)
                out["results"].append({
                    "columns": [d[0] for d in cur.description],
                    "rows": [[_cell(v) for v in r] for r in rows[:max_rows]],
                    "truncated": len(rows) > max_rows,
                })
            else:
                out["results"].append({"message": f"{max(cur.rowcount, 0)} row(s) changed"})
    except sqlite3.Error as e:
        msg = str(e)
        if "interrupted" in msg:
            msg = "The query took too long and was stopped."
        elif "not authorized" in msg:
            msg = "That SQL command is not allowed here (ATTACH, PRAGMA and extensions are blocked)."
        out["error"] = msg
    sys.stdout.write(json.dumps(out, default=str))


if __name__ == "__main__":
    main()
