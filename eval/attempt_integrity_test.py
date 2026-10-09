"""Skill Arena attempt-integrity reproduction, using fastapi.testclient.TestClient
against app.main.app with a STUBBED question generator (never calls the real
Gemini API). Verifies: resume-without-reroll, no answer keys leaked to the
client, violations recorded as evidence only (never affecting the score),
one-submission-per-attempt (409 on resubmit), expiry handling, and the three
scoring combinations the paper quotes.
"""
import datetime as dt
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from _common import setup_backend_env, Report  # noqa: E402

setup_backend_env("attempt_integrity.db")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import inspect as sa_inspect  # noqa: E402

from app import models  # noqa: E402
from app import auth  # noqa: E402
from app.database import engine, SessionLocal, Base  # noqa: E402
import app.main as app_main  # noqa: E402
import app.routers.assessments as assessments_router  # noqa: E402

CALL_COUNT = {"n": 0}


def fixed_coding_tests(delta_fn):
    return [{"args": [n], "expected": delta_fn(n)} for n in (1, 2, 3)]


def fake_generate_assessment(skill_name, level=None):
    """Deterministic stand-in for services.question_generator.generate_assessment.
    Never contacts Gemini. 20 objective items (marks=1 each) + 2 coding
    problems (marks=5 each) = 30 marks total, matching the 66.7 / 33.3 figures
    the paper quotes for partial scores."""
    CALL_COUNT["n"] += 1
    questions = []
    for i in range(20):
        questions.append(
            {
                "id": f"fixed-mcq-{i}",
                "topic": "General",
                "type": "mcq",
                "marks": 1,
                "question": f"Fixed objective question {i}?",
                "options": ["OptA", "OptB", "OptC", "OptD"],
                "answer": "OptA",
                "explanation": "OptA is correct by construction of this fixture.",
            }
        )
    coding_specs = [("solve_0", lambda n: n + 1), ("solve_1", lambda n: n * 2)]
    for j, (fn_name, delta_fn) in enumerate(coding_specs):
        questions.append(
            {
                "id": f"fixed-code-{j}",
                "topic": "General",
                "type": "coding",
                "marks": 5,
                "title": f"Fixed coding problem {j}",
                "question": "Return the input plus one." if j == 0 else "Return double the input.",
                "function_name": fn_name,
                "starter_code": f"def {fn_name}(x):\n    pass",
                "tests": fixed_coding_tests(delta_fn),
            }
        )
    return questions


CORRECT_CODE = {
    "fixed-code-0": "def solve_0(x):\n    return x + 1",
    "fixed-code-1": "def solve_1(x):\n    return x * 2",
}


def all_correct_answers(question_ids):
    answers = []
    for qid in question_ids:
        if qid.startswith("fixed-mcq-"):
            answers.append({"question_id": qid, "answer": "OptA"})
        else:
            answers.append({"question_id": qid, "answer": CORRECT_CODE[qid]})
    return answers


def all_wrong_objective_correct_code(question_ids):
    answers = []
    for qid in question_ids:
        if qid.startswith("fixed-mcq-"):
            answers.append({"question_id": qid, "answer": "OptB"})
        else:
            answers.append({"question_id": qid, "answer": CORRECT_CODE[qid]})
    return answers


def correct_objective_blank_code(question_ids):
    answers = []
    for qid in question_ids:
        if qid.startswith("fixed-mcq-"):
            answers.append({"question_id": qid, "answer": "OptA"})
        else:
            answers.append({"question_id": qid, "answer": ""})
    return answers


def main() -> bool:
    r = Report("Attempt integrity (Skill Arena)")

    # Tables already match the current models (no legacy shape), so this is
    # a normal fresh boot -- create_all is sufficient; no need for the
    # startup ALTER-TABLE migration path (see migration_test.py for that).
    Base.metadata.create_all(engine)

    assessments_router.generate_assessment = fake_generate_assessment

    db = SessionLocal()
    user = models.User(
        name="Eval User",
        email="eval-attempt-integrity@example.test",
        hashed_password=auth.hash_password("EvalPass123!"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()

    token = auth.create_access_token({"sub": str(user_id)})
    headers = {"Authorization": f"Bearer {token}"}

    client = TestClient(app_main.app)

    def start(skill_name="Python"):
        resp = client.post("/assessments/start", json={"skill_name": skill_name}, headers=headers)
        return resp

    def submit(attempt_id, answers, violations=0, terminated=False, skill_name="Python"):
        payload = {
            "skill_name": skill_name,
            "role": "learning",
            "answers": answers,
            "attempt_id": attempt_id,
            "violations": violations,
            "terminated": terminated,
        }
        return client.post("/assessments/submit", json=payload, headers=headers)

    def session_row(attempt_id):
        db2 = SessionLocal()
        row = db2.query(models.AssessmentSession).filter(models.AssessmentSession.id == attempt_id).first()
        db2.close()
        return row

    # ---- 1. First start: fresh attempt ------------------------------------
    resp1 = start()
    r.check("start -> 200", resp1.status_code == 200, f"status={resp1.status_code} body={resp1.text}")
    data1 = resp1.json()
    r.check("start #1 -> resumed=false", data1.get("resumed") is False)
    expected_seconds = assessments_router.ARENA_DURATION_MINUTES * 60
    r.check(
        "start #1 -> seconds_remaining close to configured duration",
        abs(data1.get("seconds_remaining", -1) - expected_seconds) <= 5,
        f"seconds_remaining={data1.get('seconds_remaining')} expected~={expected_seconds}",
    )
    r.check("start #1 -> expires_at present", bool(data1.get("expires_at")))
    r.check("start #1 -> generator called once", CALL_COUNT["n"] == 1, f"call_count={CALL_COUNT['n']}")

    attempt_id_1 = data1["attempt_id"]
    ids_1 = sorted(q["id"] for q in data1["questions"])

    # ---- 2. Second start resumes, no reroll --------------------------------
    resp2 = start()
    data2 = resp2.json()
    r.check("start #2 -> resumed=true", data2.get("resumed") is True)
    r.check("start #2 -> same attempt_id", data2.get("attempt_id") == attempt_id_1)
    r.check("start #2 -> same question ids (no reroll)", sorted(q["id"] for q in data2["questions"]) == ids_1)
    r.check("start #2 -> generator still called once", CALL_COUNT["n"] == 1, f"call_count={CALL_COUNT['n']}")

    # ---- 3. No answer keys leaked -------------------------------------------
    leaked = any({"answer", "tests", "explanation"} & set(q.keys()) for q in data2["questions"])
    r.check("questions payload has no answer/tests/explanation keys", not leaked)

    # ---- 4. Submit with violations=3, terminated=true ----------------------
    resp_v3 = submit(attempt_id_1, all_correct_answers(ids_1), violations=3, terminated=True)
    r.check("submit (violations=3) -> 200", resp_v3.status_code == 200, resp_v3.text)
    result_v3 = resp_v3.json()
    r.check("submit (violations=3) -> score 100.0", result_v3.get("score") == 100.0, f"score={result_v3.get('score')}")
    r.check("submit (violations=3) -> violations echoed as 3", result_v3.get("violations") == 3)
    r.check("submit (violations=3) -> terminated echoed as true", result_v3.get("terminated") is True)
    row_v3 = session_row(attempt_id_1)
    r.check(
        "DB row stores violations=3, terminated=true",
        row_v3 is not None and row_v3.violations == 3 and row_v3.terminated is True,
        f"row={row_v3 and (row_v3.violations, row_v3.terminated)}",
    )

    # ---- 5. Resubmitting the same attempt -> 409 ---------------------------
    resp_resubmit = submit(attempt_id_1, all_correct_answers(ids_1), violations=0, terminated=False)
    r.check("resubmitting attempt_id_1 -> 409", resp_resubmit.status_code == 409, resp_resubmit.text)

    # ---- 6. New start after submission (generator called again) -----------
    resp3 = start()
    data3 = resp3.json()
    r.check("start after submission -> resumed=false (new attempt)", data3.get("resumed") is False)
    r.check("start after submission -> different attempt_id", data3.get("attempt_id") != attempt_id_1)
    r.check("start after submission -> generator called a second time", CALL_COUNT["n"] == 2, f"call_count={CALL_COUNT['n']}")

    attempt_id_2 = data3["attempt_id"]
    ids_2 = sorted(q["id"] for q in data3["questions"])
    resp_v0 = submit(attempt_id_2, all_correct_answers(ids_2), violations=0, terminated=False)
    result_v0 = resp_v0.json()
    r.check(
        "same correct answers, violations=0 -> identical score to violations=3 case",
        result_v0.get("score") == result_v3.get("score") == 100.0,
        f"violations=0 score={result_v0.get('score')} violations=3 score={result_v3.get('score')}",
    )

    # ---- 7. Expiry handling --------------------------------------------------
    resp4 = start()
    data4 = resp4.json()
    attempt_id_expired = data4["attempt_id"]
    r.check("start -> generator called a third time", CALL_COUNT["n"] == 3, f"call_count={CALL_COUNT['n']}")

    db3 = SessionLocal()
    row = db3.query(models.AssessmentSession).filter(models.AssessmentSession.id == attempt_id_expired).first()
    row.expires_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)
    db3.commit()
    db3.close()

    resp5 = start()
    data5 = resp5.json()
    r.check(
        "start does not resume an attempt whose expires_at is in the past",
        data5.get("resumed") is False and data5.get("attempt_id") != attempt_id_expired,
        f"resumed={data5.get('resumed')} attempt_id={data5.get('attempt_id')}",
    )
    r.check("start -> generator called a fourth time", CALL_COUNT["n"] == 4, f"call_count={CALL_COUNT['n']}")

    ids_expired = sorted(q["id"] for q in data4["questions"])
    resp_late = submit(attempt_id_expired, all_correct_answers(ids_expired), violations=0, terminated=False)
    result_late = resp_late.json()
    r.check(
        "submitting a late attempt comes back flagged terminated even though the client said false",
        resp_late.status_code == 200 and result_late.get("terminated") is True,
        f"status={resp_late.status_code} terminated={result_late.get('terminated')}",
    )

    # ---- 8. Scoring combinations --------------------------------------------
    resp_a = start()
    ids_a = sorted(q["id"] for q in resp_a.json()["questions"])
    result_a = submit(resp_a.json()["attempt_id"], all_correct_answers(ids_a)).json()
    r.check("all correct (objective + coding) -> 100.0", result_a.get("score") == 100.0, f"score={result_a.get('score')}")

    resp_b = start()
    ids_b = sorted(q["id"] for q in resp_b.json()["questions"])
    result_b = submit(resp_b.json()["attempt_id"], correct_objective_blank_code(ids_b)).json()
    r.check(
        "correct objective + blank code -> 66.7 (20 of 30 marks)",
        result_b.get("score") == 66.7,
        f"score={result_b.get('score')}",
    )

    resp_c = start()
    ids_c = sorted(q["id"] for q in resp_c.json()["questions"])
    result_c = submit(resp_c.json()["attempt_id"], all_wrong_objective_correct_code(ids_c)).json()
    r.check(
        "wrong objective + correct code -> 33.3 (10 of 30 marks)",
        result_c.get("score") == 33.3,
        f"score={result_c.get('score')}",
    )

    return r.summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
