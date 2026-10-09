"""Table III (sandbox security) reproduction.

Calls app.services.code_runner.run_python directly with 18 code samples and
checks the outcome of each: permitted language features must RUN, dangerous
imports and attribute escapes must be REFUSED, and resource-exhaustion
attempts must be CONTAINED (bounded wall time, no crash of the caller),
regardless of whether the real OS memory/CPU limits are enforced on the
machine this script happens to run on.

NOTE on platform: code_runner._limit_resources (RLIMIT_AS / RLIMIT_CPU) is
installed via preexec_fn and only takes effect on POSIX (os.name == 'posix').
On Windows this script still exercises the wall-clock timeout (which is
enforced on every platform via subprocess.run(timeout=...)), but the
[0] * 10**9 case will not be capped by a 256 MB memory ceiling the way it is
on the Linux deployment target. Run this on Linux for the memory-ceiling
figures quoted in the paper; the timeout and output-truncation figures are
platform-independent.
"""
import inspect
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from _common import setup_backend_env, Report  # noqa: E402

setup_backend_env("sandbox_security.db")

from app.services import code_runner  # noqa: E402
from app.services.code_runner import run_python  # noqa: E402

WALL_CLOCK_GUARD = 15.0  # generous ceiling to prove the call doesn't hang forever


def timed_run(code: str, timeout: float = 4.0):
    start = time.perf_counter()
    result = run_python(code, timeout=timeout)
    elapsed = time.perf_counter() - start
    return result, elapsed


def main() -> bool:
    r = Report("Sandbox security (Table III)")

    # ---- Permitted features: must RUN correctly (6) ----------------------
    permitted = [
        ("print", 'print("hello skillverse")', "hello skillverse"),
        ("list comprehension", "print([x * x for x in range(5)])", "[0, 1, 4, 9, 16]"),
        (
            "dict and set comprehension",
            "d = {x: x * x for x in range(4)}\n"
            "s = {x % 3 for x in range(9)}\n"
            "print(d)\nprint(sorted(s))",
            "{0: 0, 1: 1, 2: 4, 3: 9}\n[0, 1, 2]",
        ),
        (
            "recursion (factorial)",
            "def factorial(n):\n"
            "    return 1 if n <= 1 else n * factorial(n - 1)\n"
            "print(factorial(6))",
            "720",
        ),
        (
            "class with inheritance and super()",
            "class Animal:\n"
            "    def __init__(self, name):\n"
            "        self.name = name\n"
            "    def speak(self):\n"
            "        return f'{self.name} makes a sound'\n"
            "class Dog(Animal):\n"
            "    def __init__(self, name):\n"
            "        super().__init__(name)\n"
            "    def speak(self):\n"
            "        return f'{self.name} barks'\n"
            "print(Dog('Rex').speak())",
            "Rex barks",
        ),
        (
            "try/except ZeroDivisionError",
            "try:\n"
            "    1 / 0\n"
            "except ZeroDivisionError:\n"
            "    print('caught')",
            "caught",
        ),
    ]
    for name, code, expected_output in permitted:
        result, _ = timed_run(code)
        ok = result["error"] is None and result["output"].strip() == expected_output
        r.check(f"RUN: {name}", ok, f"output={result['output']!r} error={result['error']!r}" if not ok else "")

    # ---- Blocked imports: must be REFUSED (4) -----------------------------
    blocked_imports = ["os", "sys", "socket", "subprocess"]
    for module in blocked_imports:
        result, _ = timed_run(f"import {module}")
        ok = result["error"] is not None and "blocked" in result["error"].lower()
        r.check(f"REFUSED: import {module}", ok, f"error={result['error']!r}" if not ok else "")

    # ---- Attribute escapes: must be REFUSED (4) ----------------------------
    escapes = [
        ("().__class__", "().__class__"),
        ('getattr((), "__class__")', 'getattr((), "__class__")'),
        ('"{0.__class__}".format(1)', '"{0.__class__}".format(1)'),
        ("object.__subclasses__()", "object.__subclasses__()"),
    ]
    for name, code in escapes:
        result, _ = timed_run(code)
        ok = result["error"] is not None
        r.check(f"REFUSED: {name}", ok, f"output={result['output']!r} error={result['error']!r}" if not ok else "")

    # ---- Resource exhaustion: must be CONTAINED (3) ------------------------
    alloc_result, alloc_elapsed = timed_run("a = [0] * 10**9\nprint(len(a))")
    r.check(
        "CONTAINED: allocate [0] * 10**9",
        alloc_elapsed < WALL_CLOCK_GUARD,
        f"elapsed={alloc_elapsed:.2f}s output={alloc_result['output']!r} error={alloc_result['error']!r}",
    )

    loop_result, loop_elapsed = timed_run("while True:\n    pass")
    ok = loop_elapsed < WALL_CLOCK_GUARD and loop_result["error"] is not None and "time limit" in loop_result["error"].lower()
    r.check(
        "CONTAINED: infinite while True loop (hits wall-clock timeout)",
        ok,
        f"elapsed={loop_elapsed:.2f}s error={loop_result['error']!r}" if not ok else "",
    )

    million_result, million_elapsed = timed_run("for i in range(1_000_000):\n    print(i)")
    ok = (
        million_elapsed < WALL_CLOCK_GUARD
        and million_result["error"] is None
        and len(million_result["output"]) <= code_runner.MAX_OUTPUT_CHARS
    )
    r.check(
        "CONTAINED: printing a million lines (output truncated, not unbounded)",
        ok,
        f"elapsed={million_elapsed:.2f}s output_len={len(million_result['output'])} cap={code_runner.MAX_OUTPUT_CHARS}"
        if not ok
        else f"output_len={len(million_result['output'])} cap={code_runner.MAX_OUTPUT_CHARS}",
    )

    # ---- Secret exposure (1) -----------------------------------------------
    import os as _os

    _os.environ["FAKE_SECRET"] = "sv-eval-secret-should-not-leak"
    secret_result, _ = timed_run("import os\nprint(os.environ.get('FAKE_SECRET', 'NOT_FOUND'))")
    import_is_blocked = secret_result["error"] is not None and "FAKE_SECRET" not in (secret_result["output"] or "")
    runner_source = inspect.getsource(run_python)
    passes_empty_env = "env={}" in runner_source.replace(" ", "")
    ok = import_is_blocked and passes_empty_env
    r.check(
        "CONTAINED: FAKE_SECRET set in the host env is unreachable from sandboxed code "
        "(blocked import + run_python always launches the child with env={})",
        ok,
        f"import_is_blocked={import_is_blocked} passes_empty_env={passes_empty_env}" if not ok else "",
    )
    del _os.environ["FAKE_SECRET"]

    return r.summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
