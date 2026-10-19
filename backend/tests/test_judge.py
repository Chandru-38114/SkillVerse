"""LeetCode-style judge, SQL sandbox, Practice API and Skill Arena coding.

Java/JavaScript tests run the code runner IN-PROCESS (runner/executor.py) when
java and node are installed; otherwise they are skipped."""
import json
import os
import shutil
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models
from backend.app.data.practice_bank import PRACTICE_BANK
from backend.app.services import judge as J
from backend.app.services import practice_service as PS
from backend.app.services.sql_runner import run_sql
from backend.app.routers import practice as PR

RUNNER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "runner")
sys.path.insert(0, os.path.abspath(RUNNER_DIR))
try:
    import executor as runner_executor  # noqa: E402
    HAVE_JAVA = bool(shutil.which("java") and shutil.which("javac"))
    HAVE_NODE = bool(shutil.which("node"))
except Exception:  # noqa: BLE001
    runner_executor, HAVE_JAVA, HAVE_NODE = None, False, False


def local_runner(language, files, entry, stdin="", time_limit=5.0):
    return runner_executor.execute(language, files, entry, stdin, time_limit)


def _java_compiler_ready():
    classes = os.path.join(RUNNER_DIR, "java", "classes")
    if not os.path.isfile(os.path.join(classes, "CompileServer.class")):
        os.makedirs(classes, exist_ok=True)
        os.system(f"javac -d {classes} {os.path.join(RUNNER_DIR, 'java', 'CompileServer.java')} > /dev/null 2>&1")
    return os.path.isfile(os.path.join(classes, "CompileServer.class"))


TWO_SUM = next(p for p in PRACTICE_BANK if p["slug"] == "two-sum")
REVERSE = next(p for p in PRACTICE_BANK if p["slug"] == "reverse-linked-list")
SQL_P = next(p for p in PRACTICE_BANK if p["slug"] == "customers-who-never-order")


class JudgeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.two_sum = PS.build_spec(TWO_SUM)
        cls.reverse = PS.build_spec(REVERSE)
        cls.sql = PS.build_spec(SQL_P)

    def test_every_bank_problem_is_valid(self):
        for raw in PRACTICE_BANK:
            with self.subTest(raw["slug"]):
                spec = PS.build_spec(raw)
                self.assertTrue(any(t.get("sample") for t in spec["tests"]))

    def test_python_accepted_wrong_and_errors(self):
        ok = "class Solution:\n    def twoSum(self, nums, target):\n        d = {}\n        for i, x in enumerate(nums):\n            if target - x in d:\n                return [i, d[target - x]]\n            d[x] = i\n"
        self.assertEqual(J.judge(self.two_sum, "python", ok)["verdict"], "Accepted")   # any order accepted
        self.assertEqual(J.judge(self.two_sum, "python", "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]")["verdict"], "Wrong Answer")
        self.assertEqual(J.judge(self.two_sum, "python", "class Solution:\n    def twoSum(self, nums, target):\n        return 1 / 0")["verdict"], "Runtime Error")
        self.assertEqual(J.judge(self.two_sum, "python", "class Solution:\n    def twoSum(self, nums, target):\n        while True: pass")["verdict"], "Time Limit Exceeded")

    def test_hidden_answers_are_not_returned(self):
        res = J.judge(self.two_sum, "python", "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]", "all")
        for item in res["results"]:
            if not item["sample"]:
                self.assertNotIn("expected", item)

    def test_printing_the_marker_cannot_fake_a_pass(self):
        cheat = "print('SVJUDGE0000' + repr([('ok', [0, 1])] * 6))\nclass Solution:\n    def twoSum(self, nums, target):\n        return [9, 9]"
        self.assertEqual(J.judge(self.two_sum, "python", cheat)["passed"], 0)

    def test_signature_and_test_validation(self):
        with self.assertRaises(J.SpecError):
            J.validate_signature({"function": "class", "params": [{"name": "a", "type": "int"}], "returns": "int"})
        with self.assertRaises(J.SpecError):
            J.validate_signature({"function": "f", "params": [{"name": "a", "type": "dict"}], "returns": "int"})
        sig = J.validate_signature({"function": "f", "params": [{"name": "a", "type": "int[]"}], "returns": "int"})
        with self.assertRaises(J.SpecError):
            J.validate_tests(sig, [{"args": ["not a list"]}], need_expected=False)

    def test_sql_problem(self):
        self.assertEqual(J.judge(self.sql, "sql", "SELECT name FROM Customers WHERE id NOT IN (SELECT customer_id FROM Orders)")["verdict"], "Accepted")
        self.assertEqual(J.judge(self.sql, "sql", "SELECT name FROM Customers")["verdict"], "Wrong Answer")

    def test_sql_sandbox_blocks_files(self):
        for q in ("ATTACH DATABASE '/tmp/x.db' AS x", "PRAGMA table_info(t)", "SELECT load_extension('/x')"):
            self.assertIn("not allowed", run_sql(q)["error"])
        self.assertIn("too long", run_sql("WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT count(*) FROM c")["error"])

    def test_starter_code(self):
        self.assertIn("class Solution", J.starter_code(self.two_sum, "python"))
        self.assertIn("public int[] twoSum(int[] nums, int target)", J.starter_code(self.two_sum, "java"))
        self.assertIn("var twoSum = function(nums, target)", J.starter_code(self.two_sum, "javascript"))

    @unittest.skipUnless(HAVE_JAVA, "java not installed")
    def test_java(self):
        self.assertTrue(_java_compiler_ready())
        with patch("backend.app.services.judge.call_runner", local_runner):
            code = "class Solution { public ListNode reverseList(ListNode h) { ListNode p = null; while (h != null) { ListNode n = h.next; h.next = p; p = h; h = n; } return p; } }"
            self.assertEqual(J.judge(self.reverse, "java", code)["verdict"], "Accepted")
            self.assertEqual(J.judge(self.reverse, "java", "class Solution { public ListNode reverseList(ListNode h) { return x; } }")["verdict"], "Compile Error")

    @unittest.skipUnless(HAVE_NODE, "node not installed")
    def test_javascript(self):
        with patch("backend.app.services.judge.call_runner", local_runner):
            code = "var reverseList = function(h) { let p = null; while (h) { const n = h.next; h.next = p; p = h; h = n; } return p; };"
            self.assertEqual(J.judge(self.reverse, "javascript", code)["verdict"], "Accepted")


class PracticeApiTest(unittest.TestCase):
    def setUp(self):
        PS._seeded = False
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.user = models.User(id=1, name="P", email="p@x.com", hashed_password="pw", points=100)
        self.db.add(self.user)
        self.db.commit()
        PR._recent_runs.clear()

    def tearDown(self):
        self.db.close()
        PS._seeded = False

    def test_list_detail_and_points_once(self):
        import asyncio
        problems = PR.list_problems(course="dsa", difficulty=None, q=None, current_user=self.user, db=self.db)
        self.assertTrue(any(p["slug"] == "two-sum" for p in problems))
        detail = PR.get_problem("two-sum", current_user=self.user, db=self.db)
        self.assertNotIn("reference", detail)
        self.assertEqual(len(detail["examples"]), 2)
        code = "class Solution:\n    def twoSum(self, nums, target):\n        d = {}\n        for i, x in enumerate(nums):\n            if target - x in d:\n                return [d[target - x], i]\n            d[x] = i\n"
        body = PR.CodeIn(language="python", code=code)
        r1 = asyncio.run(PR.submit_problem("two-sum", body, current_user=self.user, db=self.db))
        r2 = asyncio.run(PR.submit_problem("two-sum", body, current_user=self.user, db=self.db))
        self.assertEqual((r1["verdict"], r1["points"], r2["points"]), ("Accepted", 10, 0))
        self.assertEqual(self.user.points, 110)

    def test_wrong_language_and_rate_limit(self):
        import asyncio
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(PR.run_problem("customers-who-never-order", PR.CodeIn(language="python", code="x"), current_user=self.user, db=self.db))
        self.assertEqual(ctx.exception.status_code, 400)
        for _ in range(PR.RUNS_PER_MINUTE):
            PR._rate_limit(self.user.id)
        with self.assertRaises(HTTPException) as ctx:
            PR._rate_limit(self.user.id)
        self.assertEqual(ctx.exception.status_code, 429)

    def test_arena_coding_from_bank_and_answers(self):
        qs = PS.arena_coding_questions(self.db, "Java", "beginner", 2, use_ai=False)
        self.assertEqual(len(qs), 2)
        self.assertTrue(all(q["languages"] == ["java"] for q in qs))
        public = PS.arena_public_coding(qs[0])
        self.assertNotIn("spec", public)
        self.assertEqual(PS.parse_coding_answer(json.dumps({"language": "java", "code": "x"}), ["java"]), ("java", "x"))
        self.assertEqual(PS.parse_coding_answer("print(1)", ["python"]), ("python", "print(1)"))
        self.assertEqual(PS.arena_coding_questions(self.db, "Figma", "beginner", 2, use_ai=False), [])


if __name__ == "__main__":
    unittest.main()
