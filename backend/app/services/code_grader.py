import secrets

from .code_runner import run_python

TOLERANCE = 1e-6


def _is_float_like(value) -> bool:
    return isinstance(value, float) or (isinstance(value, list) and any(_is_float_like(v) for v in value))


def _build_harness(code: str, function_name: str, tests: list, marker: str) -> str:
    cases_repr = repr([(tc["args"], tc["expected"]) for tc in tests])
    lines = [
        code,
        "",
        f"svcases = {cases_repr}",
        "svmarks = []",
        "for svargs, svexpected in svcases:",
        "    try:",
        f"        svresult = {function_name}(*svargs)",
        "        if isinstance(svresult, float) or isinstance(svexpected, float):",
        f"            svok = isinstance(svresult, (int, float)) and abs(svresult - svexpected) < {TOLERANCE}",
        "        else:",
        "            svok = svresult == svexpected",
        "        svmarks.append('1' if svok else '0')",
        "    except Exception:",
        "        svmarks.append('0')",
        f"print({marker!r} + ''.join(svmarks))",
    ]
    return "\n".join(lines)


def grade_coding_answer(code: str, function_name: str, tests: list) -> dict:
    total = len(tests)
    if not code or not code.strip():
        return {"passed": 0, "total": total, "fraction": 0.0, "detail": "No answer submitted."}

    marker = "SVRESULT" + secrets.token_hex(8)
    harness = _build_harness(code, function_name, tests, marker)
    result = run_python(harness, timeout=8.0)

    output = result.get("output") or ""
    idx = output.find(marker)
    if idx == -1:
        error = (result.get("error") or "").strip()
        last_line = error.splitlines()[-1] if error else "The code did not run successfully."
        return {"passed": 0, "total": total, "fraction": 0.0, "detail": last_line}

    marks_str = output[idx + len(marker):idx + len(marker) + total]
    passed = marks_str.count("1")
    fraction = passed / total if total else 0.0
    return {"passed": passed, "total": total, "fraction": fraction, "detail": f"Passed {passed} of {total} test cases."}
