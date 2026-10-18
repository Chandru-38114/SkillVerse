"""Auto-grading of Skill Arena coding questions (see "How grading works" below)."""
import ast
import secrets

from .code_runner import run_python

TOLERANCE = 1e-6

# How grading works (and why):
# The student's function runs in the sandbox, but the PASS/FAIL decision is made
# here, in the server process. The sandboxed harness only prints repr() of each
# result, and only for plain values (int, float, str, bool, None, list, tuple,
# dict, set). Previously the comparison ran inside the student's namespace, so a
# custom object or a redefined name could make every test "pass".
# Helper names get a random suffix per run, so student code can't overwrite them,
# and builtins are captured BEFORE the student's code runs.


def _build_harness(code: str, function_name: str, tests: list, marker: str, tag: str) -> str:
    args_repr = repr([tc["args"] for tc in tests])
    p, r, t, plain = f"_p{tag}", f"_r{tag}", f"_t{tag}", f"_plain{tag}"
    return "\n".join([
        # Captured before the student code can shadow print/repr/type.
        f"{p} = print",
        f"{r} = repr",
        f"{t} = type",
        f"def {plain}(v, depth=0):",
        "    if depth > 20:",
        "        return False",
        f"    k = {t}(v)",
        "    if k in (int, float, str, bool) or v is None:",
        "        return True",
        "    if k in (list, tuple, set):",
        f"        return all({plain}(x, depth + 1) for x in v)",
        "    if k is dict:",
        f"        return all({plain}(a, depth + 1) and {plain}(b, depth + 1) for a, b in v.items())",
        "    return False",
        "",
        code,
        "",
        f"_out{tag} = []",
        f"for _a{tag} in {args_repr}:",
        "    try:",
        f"        _v{tag} = {function_name}(*_a{tag})",
        f"        _out{tag}.append({r}(_v{tag}) if {plain}(_v{tag}) else None)",
        "    except Exception:",
        f"        _out{tag}.append(None)",
        f"{p}({marker!r} + {r}(_out{tag}))",
    ])


def _matches(got, expected) -> bool:
    if isinstance(expected, bool) or isinstance(got, bool):
        return type(got) is type(expected) and got == expected
    if isinstance(expected, float) or isinstance(got, float):
        return isinstance(got, (int, float)) and isinstance(expected, (int, float)) and abs(got - expected) < TOLERANCE
    if isinstance(expected, (list, tuple)) and isinstance(got, (list, tuple)):
        return len(got) == len(expected) and all(_matches(g, e) for g, e in zip(got, expected))
    if isinstance(expected, dict) and isinstance(got, dict):
        return got.keys() == expected.keys() and all(_matches(got[k], expected[k]) for k in expected)
    return got == expected


def grade_coding_answer(code: str, function_name: str, tests: list) -> dict:
    total = len(tests)
    if not code or not code.strip():
        return {"passed": 0, "total": total, "fraction": 0.0, "detail": "No answer submitted."}

    marker = "SVRESULT" + secrets.token_hex(8)
    tag = secrets.token_hex(6)
    harness = _build_harness(code, function_name, tests, marker, tag)
    result = run_python(harness, timeout=8.0)

    output = result.get("output") or ""
    idx = output.rfind(marker)
    if idx == -1:
        error = (result.get("error") or "").strip()
        last_line = error.splitlines()[-1] if error else "The code did not run successfully."
        return {"passed": 0, "total": total, "fraction": 0.0, "detail": last_line}

    line = output[idx + len(marker):].splitlines()[0] if output[idx + len(marker):] else ""
    try:
        reprs = ast.literal_eval(line)
    except (ValueError, SyntaxError):
        reprs = []
    if not isinstance(reprs, list) or len(reprs) != total:
        return {"passed": 0, "total": total, "fraction": 0.0, "detail": "Could not read the test results."}

    passed = 0
    for rep, tc in zip(reprs, tests):
        if rep is None:
            continue
        try:
            got = ast.literal_eval(rep)
        except (ValueError, SyntaxError):
            continue
        if _matches(got, tc["expected"]):
            passed += 1

    fraction = passed / total if total else 0.0
    return {"passed": passed, "total": total, "fraction": fraction, "detail": f"Passed {passed} of {total} test cases."}
