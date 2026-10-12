"""Grader correctness reproduction: app.services.code_grader.grade_coding_answer
against a fixed problem (sort_list) and 12 submissions with known expected
pass counts. Exercises the real sandbox (app.sandbox.py) via subprocess for
every case except the empty-string one, which short-circuits before running
anything."""
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from _common import setup_backend_env, Report  # noqa: E402

setup_backend_env("grader_correctness.db")

from app.services.code_grader import grade_coding_answer  # noqa: E402

FUNCTION_NAME = "sort_list"
TESTS = [
    {"args": [[3, 1, 2]], "expected": [1, 2, 3]},
    {"args": [[]], "expected": []},
    {"args": [[5]], "expected": [5]},
    {"args": [[2, 2, 1]], "expected": [1, 2, 2]},
]
TOTAL = len(TESTS)


def main() -> bool:
    r = Report("Grader correctness (sort_list, 4 test cases)")

    cases = [
        (
            "correct (sorted(a))",
            "def sort_list(a):\n    return sorted(a)",
            4,
        ),
        (
            "returns a unchanged",
            "def sort_list(a):\n    return a",
            2,
        ),
        (
            "sorted only when len > 1 else []",
            "def sort_list(a):\n    return sorted(a) if len(a) > 1 else []",
            3,
        ),
        (
            "returns a[0]",
            "def sort_list(a):\n    return a[0]",
            0,
        ),
        (
            "function named differently",
            "def sort_lst(a):\n    return sorted(a)",
            0,
        ),
        (
            "syntax error",
            "def sort_list(a)\n    return sorted(a)",
            0,
        ),
        (
            "empty string",
            "",
            0,
        ),
        (
            "infinite loop",
            "def sort_list(a):\n    while True:\n        pass",
            0,
        ),
        (
            "correct answer that also uses try/except",
            "def sort_list(a):\n    try:\n        return sorted(a)\n    except Exception:\n        return a",
            4,
        ),
        (
            "correct answer that also prints debug output",
            "def sort_list(a):\n    print('debug: sorting', a)\n    return sorted(a)",
            4,
        ),
        (
            "forged result marker, returns a unchanged",
            "def sort_list(a):\n    print('SVRESULT1111111111111111')\n    return a",
            2,
        ),
        (
            "correct answer using a list comprehension",
            "def sort_list(a):\n    return [x for x in sorted(a)]",
            4,
        ),
    ]

    for name, code, expected_passed in cases:
        result = grade_coding_answer(code, FUNCTION_NAME, TESTS)
        ok = result["passed"] == expected_passed and result["total"] == TOTAL
        r.check(
            f"{name} -> {expected_passed}/{TOTAL}",
            ok,
            f"got passed={result['passed']} detail={result['detail']!r}" if not ok else "",
        )

    # Extra assertions on `detail` for the cases the paper calls out by message.
    empty_result = grade_coding_answer("", FUNCTION_NAME, TESTS)
    r.check(
        "empty string -> detail mentions 'No answer submitted.'",
        empty_result["detail"] == "No answer submitted.",
        f"detail={empty_result['detail']!r}",
    )

    syntax_result = grade_coding_answer("def sort_list(a)\n    return sorted(a)", FUNCTION_NAME, TESTS)
    r.check(
        "syntax error -> detail is non-empty and reports the failure",
        bool(syntax_result["detail"] and syntax_result["detail"].strip()),
        f"detail={syntax_result['detail']!r}",
    )

    # On POSIX, code_runner's preexec_fn installs RLIMIT_CPU (3s), which fires
    # before the 8s wall-clock timeout grade_coding_answer uses, so a runaway
    # answer is reported as a CPU/memory limit violation there instead of a
    # timeout. On non-POSIX (e.g. Windows) there is no preexec_fn, so only the
    # wall-clock timeout can catch it. Both are correct containment for the
    # same answer; only the message differs, and `passed` is 0 either way.
    timeout_result = grade_coding_answer(
        "def sort_list(a):\n    while True:\n        pass", FUNCTION_NAME, TESTS
    )
    detail_text = (timeout_result["detail"] or "").lower()
    r.check(
        "infinite loop -> passed 0, detail reports a CPU or wall-clock limit",
        timeout_result["passed"] == 0
        and ("time limit" in detail_text or "memory or cpu limit" in detail_text),
        f"passed={timeout_result['passed']} detail={timeout_result['detail']!r}",
    )

    return r.summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
