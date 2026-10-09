# SkillVerse evaluation suite

Reproducible measurement scripts backing the numbers quoted in the paper.
These are **measurement scripts, not application code** — they live outside
`backend/` and `frontend/` and never modify either. Each script prints a
`PASS`/`FAIL` line per scenario and a summary count at the end; those counts
are what the paper cites.

Every script that touches the backend (all but `latency_test.py`) adds
`backend/` to `sys.path`, points `DATABASE_URL` at a throwaway SQLite file
under `eval/tmp/` (git-ignored, created fresh per run), and sets a dummy
`SECRET_KEY` / `GEMINI_API_KEY`. None of them ever contact the real Gemini
API — `attempt_integrity_test.py` stubs the question generator function
directly; the other three don't call it at all.

| Script | What it verifies | Paper section |
|---|---|---|
| `sandbox_security_test.py` | The compiler sandbox (`app/sandbox.py` via `app.services.code_runner.run_python`): 6 permitted language features run correctly, 4 blocked imports and 4 attribute-escape attempts are refused, 3 resource-exhaustion attempts are contained (bounded wall time, truncated output), and a secret set in the host environment is unreachable from sandboxed code. | Table III (sandbox security) |
| `grader_correctness_test.py` | Auto-grading (`app.services.code_grader.grade_coding_answer`) against a fixed `sort_list` problem and 12 submissions with known expected pass counts, including a forged-result-marker attempt that must earn nothing. | Auto-grading correctness |
| `attempt_integrity_test.py` | End-to-end `/assessments/start` and `/assessments/submit` behavior via `TestClient`, with a stubbed generator: resume without reroll, no answer keys sent to the client, violations recorded as evidence only (never affecting score), 409 on resubmission, expiry handling, and the 100.0 / 66.7 / 33.3 scoring combinations. | Exam-integrity guarantees |
| `migration_test.py` | The startup schema migration in `app/main.py`: upgrading a legacy `assessment_sessions` table (missing `expires_at`/`violations`/`terminated`) in place, preserving the existing row with safe defaults, and idempotency on a second boot. | Migration safety |
| `latency_test.py` | Real question-generation latency against the **deployed** backend (not a stub) — ten `POST /assessments/start` calls for Python, reporting mean/min/max and flagging any bank-fallback responses so they can be excluded from the AI-generation figure. | Generation latency |

## Running

```
cd backend && pip install -r requirements.txt   # if not already installed
cd ..
python eval/sandbox_security_test.py
python eval/grader_correctness_test.py
python eval/attempt_integrity_test.py
python eval/migration_test.py

# Latency test needs a real deployment and a logged-in user's token:
EVAL_BASE_URL=https://your-backend.onrender.com EVAL_JWT=eyJ... python eval/latency_test.py
```

## A FAIL must be investigated, never reported as a pass

If any scenario prints `FAIL`, that is a real discrepancy between this
reproduction and the behavior described in the paper (or a regression in the
code since the paper was written). Do not round a `FAIL` up or omit it from
the reported counts — find the cause (a code change, a platform difference,
a flaky timing assumption) and either fix the script, fix the code, or
correct the paper's claim.

## Platform note (sandbox memory/CPU limits)

`app/services/code_runner.py` installs the 256 MB memory / 3 s CPU limits via
`preexec_fn`, which only runs on POSIX (the Render deployment target is
Linux). On a non-POSIX dev machine (e.g. Windows), `sandbox_security_test.py`
still exercises the OS-independent wall-clock timeout, but the `[0] * 10**9`
memory-exhaustion case won't be capped by the 256 MB ceiling the way it is in
production. Run that script on Linux for the memory-ceiling figures quoted
in the paper; the timeout and output-truncation figures hold on any platform.

The infinite-loop containment cases (in both `sandbox_security_test.py` and
`grader_correctness_test.py`) accept either containment message for this same
reason: on Linux the 3s RLIMIT_CPU fires first and the runaway code is
reported as a CPU/memory limit violation, while on Windows (no rlimits) only
the wall-clock timeout can catch it, reported as "exceeded the time limit."
Both are correct containment of the same program. The figures quoted in the
paper must be measured on Linux, matching deployment — that is the path that
exercises the real RLIMIT_CPU/RLIMIT_AS enforcement, not just the fallback
wall-clock timeout.
