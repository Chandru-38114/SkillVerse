"""Runner tests. Need java + node on PATH (or runner/tools from build.sh).
Run from the runner folder:  python -m pytest tests -q"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["RUNNER_TOKEN"] = "test-token"

from fastapi.testclient import TestClient  # noqa: E402
import app as runner_app  # noqa: E402
import executor  # noqa: E402

runner_app.TOKEN = "test-token"
HAVE = executor.available()


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(runner_app.app)
        self.h = {"X-Runner-Token": "test-token"}

    def run_code(self, language, files, entry, stdin="", tl=4):
        r = self.c.post("/run", headers=self.h, json={"language": language, "files": files, "entry": entry, "stdin": stdin, "time_limit": tl})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_token_required(self):
        r = self.c.post("/run", json={"language": "java", "files": {"Main.java": ""}, "entry": "Main"})
        self.assertEqual(r.status_code, 401)
        r = self.c.post("/run", headers={"X-Runner-Token": "wrong"}, json={"language": "java", "files": {"Main.java": ""}, "entry": "Main"})
        self.assertEqual(r.status_code, 401)

    def test_only_java_and_js(self):
        r = self.c.post("/run", headers=self.h, json={"language": "bash", "files": {"a.sh": "ls"}, "entry": "a.sh"})
        self.assertEqual(r.status_code, 422)

    @unittest.skipUnless(HAVE["java"], "java not installed")
    def test_java_runs_reads_stdin_and_is_locked(self):
        out = self.run_code("java", {"Main.java": "import java.util.*; public class Main { public static void main(String[] a){ System.out.println(new Scanner(System.in).nextInt() * 2); } }"}, "Main", "21\n")
        self.assertEqual((out["status"], out["stdout"].strip()), ("ok", "42"))
        out = self.run_code("java", {"Main.java": "public class Main { public static void main(String[] a) throws Exception { System.out.println(System.getenv(\"RUNNER_TOKEN\")); } }"}, "Main")
        self.assertEqual(out["status"], "runtime_error")
        self.assertIn("AccessControlException", out["stderr"])
        out = self.run_code("java", {"Main.java": "public class Main { public static void main(String[] a){ new java.net.Socket(); try { new java.net.Socket(\"1.1.1.1\", 80); } catch (Exception e) { throw new RuntimeException(e); } } }"}, "Main")
        self.assertIn("AccessControlException", out["stderr"])
        out = self.run_code("java", {"Main.java": "public class Main { public static void main(String[] a){ while (true) {} } }"}, "Main", tl=1.5)
        self.assertEqual(out["status"], "timeout")
        out = self.run_code("java", {"Main.java": "public class Main { void x( }"}, "Main")
        self.assertEqual(out["status"], "compile_error")

    @unittest.skipUnless(HAVE["javascript"], "node not installed")
    def test_javascript_runs_and_is_locked(self):
        out = self.run_code("javascript", {"main.js": "console.log([1,2,3].map(x => x * x).join(','))"}, "main.js")
        self.assertEqual((out["status"], out["stdout"].strip()), ("ok", "1,4,9"))
        out = self.run_code("javascript", {"main.js": "console.log(process.env.RUNNER_TOKEN === undefined ? 'no token' : 'LEAK')"}, "main.js")
        self.assertEqual(out["stdout"].strip(), "no token")
        out = self.run_code("javascript", {"main.js": "require('fs').readFileSync('/etc/passwd')"}, "main.js")
        self.assertEqual(out["status"], "runtime_error")
        self.assertIn("ERR_ACCESS_DENIED", out["stderr"])
        out = self.run_code("javascript", {"main.js": "require('child_process').execSync('id')"}, "main.js")
        self.assertIn("ERR_ACCESS_DENIED", out["stderr"])
        out = self.run_code("javascript", {"main.js": "for(;;){}"}, "main.js", tl=1.5)
        self.assertEqual(out["status"], "timeout")


if __name__ == "__main__":
    unittest.main()
