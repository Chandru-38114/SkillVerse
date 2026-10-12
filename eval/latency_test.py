"""Real question-generation latency against the DEPLOYED backend.

This is the one number the paper didn't have yet: wall-clock time for
POST /assessments/start to return a freshly generated Python assessment,
measured against the actual Render deployment (or whatever base URL you
point it at), not a stub.

This script does NOT import anything from backend/ and never touches a
database directly -- it only speaks HTTP to a running server, using
credentials you provide. It never hardcodes a URL or a token.

Usage:
    EVAL_BASE_URL=https://your-backend.onrender.com EVAL_JWT=eyJ... \
        python eval/latency_test.py

EVAL_BASE_URL: the backend's base URL, no trailing slash.
EVAL_JWT:      a valid access token for an already-registered user
               (e.g. copy the token your frontend stores after logging in).
EVAL_RUNS:     optional, number of /assessments/start calls to time (default 10).
"""
import os
import statistics
import sys
import time

try:
    import requests
except ImportError:
    print("This script needs the `requests` package: pip install requests", file=sys.stderr)
    sys.exit(1)

BASE_URL = os.environ.get("EVAL_BASE_URL", "").rstrip("/")
JWT = os.environ.get("EVAL_JWT", "")
RUNS = int(os.environ.get("EVAL_RUNS", "10"))
SKILL = "Python"


def abandon_or_submit(attempt_id: str, headers: dict) -> None:
    """Submit a trivial (all-wrong) answer set so the attempt is marked
    submitted and the next /start call generates a fresh one instead of
    resuming. A failed submit is non-fatal for the latency measurement."""
    try:
        requests.post(
            f"{BASE_URL}/assessments/submit",
            json={"skill_name": SKILL, "role": "learning", "answers": [], "attempt_id": attempt_id},
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as err:
        print(f"  (warning: could not close attempt {attempt_id}: {err})", file=sys.stderr)


def main() -> int:
    if not BASE_URL or not JWT:
        print("Set EVAL_BASE_URL and EVAL_JWT environment variables before running this script.", file=sys.stderr)
        return 1

    headers = {"Authorization": f"Bearer {JWT}"}
    durations = []
    sources = []

    print(f"Measuring POST {BASE_URL}/assessments/start latency for skill={SKILL!r}, {RUNS} runs...\n")

    for i in range(1, RUNS + 1):
        start = time.perf_counter()
        try:
            resp = requests.post(
                f"{BASE_URL}/assessments/start",
                json={"skill_name": SKILL},
                headers=headers,
                timeout=180,
            )
        except requests.RequestException as err:
            print(f"run {i}: request failed: {err}")
            continue
        elapsed = time.perf_counter() - start

        if resp.status_code != 200:
            print(f"run {i}: HTTP {resp.status_code}: {resp.text[:300]}")
            continue

        data = resp.json()
        source = data.get("source", "unknown")
        attempt_id = data.get("attempt_id")
        durations.append(elapsed)
        sources.append(source)
        print(f"run {i}: {elapsed:.3f}s  source={source}  attempt_id={attempt_id}")

        if attempt_id:
            abandon_or_submit(attempt_id, headers)

    if not durations:
        print("\nNo successful runs; nothing to report.")
        return 1

    bank_runs = sum(1 for s in sources if s == "bank")
    print(f"\n{len(durations)} successful run(s). {bank_runs} used the static bank fallback (source='bank') "
          f"-- exclude those from AI-generation latency figures.")

    ai_durations = [d for d, s in zip(durations, sources) if s != "bank"]
    print("\n-- All runs --")
    print(f"mean = {statistics.mean(durations):.3f}s")
    print(f"min  = {min(durations):.3f}s")
    print(f"max  = {max(durations):.3f}s")

    if ai_durations:
        print("\n-- AI-generated runs only (source != 'bank') --")
        print(f"mean = {statistics.mean(ai_durations):.3f}s")
        print(f"min  = {min(ai_durations):.3f}s")
        print(f"max  = {max(ai_durations):.3f}s")
    else:
        print("\nAll runs used the bank fallback; no AI-generation latency figure to report.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
