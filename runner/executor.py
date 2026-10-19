"""
Runs untrusted Java and JavaScript for the SkillVerse code runner.

Safety layers (this service holds NO database, NO user data and NO API keys):
- Java runs under Java 21's security manager with an empty policy: no files,
  no network, no environment variables, no starting programs, no reflection tricks.
- JavaScript runs under Node's permission mode: it can only read its own folder,
  and can't start programs, workers or write files.
- Every run gets a fresh temporary folder (deleted afterwards), an EMPTY
  environment, a CPU limit, a wall-clock timeout that kills the whole process
  group, a heap limit and an output cap.
- One run at a time, so nobody's code ever shares the machine with someone else's.
"""
import base64
import os
import resource
import shutil
import signal
import subprocess
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.environ.get("RUNNER_TOOLS_DIR", os.path.join(HERE, "tools"))
POLICY = os.path.join(HERE, "sandbox.policy")
MAX_OUTPUT = 64_000
MAX_CPU_SECONDS = 6
QUEUE_WAIT_SECONDS = 25

_run_lock = threading.Lock()


def _find(binary: str, *candidates: str) -> str:
    """Prefer the tools downloaded by build.sh, else what's on PATH."""
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return shutil.which(binary) or ""


def _tool(name: str) -> str:
    if name == "java":
        return _find("java", os.path.join(TOOLS, "jdk", "bin", "java"))
    if name == "node":
        return _find("node", os.path.join(TOOLS, "node", "bin", "node"))
    return ""


def available() -> dict:
    return {"java": bool(_tool("java")), "javascript": bool(_tool("node"))}


def _limits(cpu_seconds: int):
    def apply():
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024 * 1024, 2 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    return apply


def _run(cmd: list, cwd: str, stdin: str, timeout: float, cpu_seconds: int) -> dict:
    """Start the process in its own group with an empty environment; kill the group on timeout."""
    started = time.monotonic()
    proc = subprocess.Popen(
        cmd, cwd=cwd, env={}, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        start_new_session=True, preexec_fn=_limits(cpu_seconds),
    )
    timed_out = False
    try:
        out, err = proc.communicate(input=(stdin or "").encode("utf-8"), timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        out, err = proc.communicate()
    elapsed = int((time.monotonic() - started) * 1000)
    rc = proc.returncode
    # SIGXCPU / SIGKILL from the CPU limit also counts as "too slow".
    if rc in (-signal.SIGXCPU, -signal.SIGKILL) and not timed_out:
        timed_out = True
    return {
        "stdout": out.decode("utf-8", "replace")[:MAX_OUTPUT],
        "stderr": err.decode("utf-8", "replace")[:MAX_OUTPUT],
        "exit_code": rc, "timed_out": timed_out, "time_ms": elapsed,
    }


# ---------------------------------------------------------------------------
# Java: a warm compiler process + a fresh locked-down JVM per run
# ---------------------------------------------------------------------------
class _Compiler:
    def __init__(self):
        self.proc = None
        self.lock = threading.Lock()

    def _start(self):
        java = _tool("java")
        classes = os.path.join(HERE, "java", "classes")
        self.proc = subprocess.Popen(
            [java, "-Xmx192m", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Xshare:auto",
             "-cp", classes, "CompileServer"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            env={}, text=True, bufsize=1,
        )

    def _stop(self):
        if self.proc:
            try:
                self.proc.kill()
            except Exception:
                pass
        self.proc = None

    def compile(self, folder: str, timeout: float = 20.0) -> tuple:
        """(ok, messages). Restarts the compiler if it hangs or dies."""
        with self.lock:
            if self.proc is None or self.proc.poll() is not None:
                self._start()
            result = {}

            def talk():
                self.proc.stdin.write(folder + "\n")
                self.proc.stdin.flush()
                result["line"] = self.proc.stdout.readline()

            t = threading.Thread(target=talk, daemon=True)
            t.start()
            t.join(timeout)
            line = result.get("line")
            if not line:
                self._stop()
                return False, "Compilation took too long."
            line = line.strip()
            if line == "OK":
                return True, ""
            if line.startswith("ERR "):
                return False, base64.b64decode(line[4:]).decode("utf-8", "replace")
            return False, "Compiler problem."


_compiler = _Compiler()


def warm_up():
    """Compile a tiny program once at start-up so the first real run is fast."""
    if not _tool("java"):
        return
    folder = tempfile.mkdtemp(prefix="warm-")
    try:
        with open(os.path.join(folder, "Main.java"), "w") as f:
            f.write("public class Main { public static void main(String[] a) { System.out.println(1); } }")
        _compiler.compile(folder, timeout=60)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def _java_cmd(classes: str, main_class: str) -> list:
    return [
        _tool("java"),
        "-Djava.security.manager=allow", "-Djava.security.manager", f"-Djava.security.policy=={POLICY}",
        "-Xmx128m", "-Xss32m", "-XX:MaxMetaspaceSize=64m", "-XX:MaxDirectMemorySize=16m",
        "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-Xshare:auto", "-XX:-UsePerfData",
        "-Dfile.encoding=UTF-8", "-Dstdout.encoding=UTF-8",
        "-cp", classes, main_class,
    ]


def _clean_java_stderr(text: str) -> str:
    """Drop the JVM's security-manager warnings so students only see their own errors."""
    keep = [ln for ln in text.splitlines()
            if not ln.startswith("WARNING: ") or "Security Manager" not in ln]
    return "\n".join(keep).strip()


def run_java(files: dict, main_class: str, stdin: str, time_limit: float) -> dict:
    folder = tempfile.mkdtemp(prefix="java-")
    try:
        for name, content in files.items():
            with open(os.path.join(folder, os.path.basename(name)), "w", encoding="utf-8") as f:
                f.write(content)
        ok, messages = _compiler.compile(folder)
        if not ok:
            return {"status": "compile_error", "compile_output": messages[:MAX_OUTPUT], "stdout": "", "stderr": "", "time_ms": 0}
        res = _run(_java_cmd(os.path.join(folder, "classes"), main_class), folder, stdin, time_limit, MAX_CPU_SECONDS)
        res["stderr"] = _clean_java_stderr(res["stderr"])
        return _finish(res)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


# ---------------------------------------------------------------------------
# JavaScript (Node)
# ---------------------------------------------------------------------------
_node_flag = None


def _node_permission_flag() -> str:
    """Node 22 has '--permission' (older: '--experimental-permission')."""
    global _node_flag
    if _node_flag is None:
        node = _tool("node")
        _node_flag = "--experimental-permission"
        try:
            if subprocess.run([node, "--permission", "-e", "0"], env={}, capture_output=True, timeout=20).returncode == 0:
                _node_flag = "--permission"
        except Exception:
            pass
    return _node_flag


def run_javascript(files: dict, entry: str, stdin: str, time_limit: float) -> dict:
    folder = tempfile.mkdtemp(prefix="js-")
    try:
        for name, content in files.items():
            with open(os.path.join(folder, os.path.basename(name)), "w", encoding="utf-8") as f:
                f.write(content)
        cmd = [_tool("node"), _node_permission_flag(), f"--allow-fs-read={folder}",
               "--max-old-space-size=128", "--stack-size=8000", os.path.join(folder, os.path.basename(entry))]
        return _finish(_run(cmd, folder, stdin, time_limit, MAX_CPU_SECONDS))
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def _finish(res: dict) -> dict:
    if res["timed_out"]:
        res["status"] = "timeout"
    elif res["exit_code"] != 0:
        res["status"] = "runtime_error"
    else:
        res["status"] = "ok"
    res.setdefault("compile_output", "")
    res.pop("timed_out", None)
    return res


def execute(language: str, files: dict, entry: str, stdin: str = "", time_limit: float = 5.0) -> dict:
    """The one entry point. Waits its turn: one program at a time."""
    if not _tool("java" if language == "java" else "node"):
        return {"status": "unavailable", "stdout": "", "stderr": "", "compile_output": "",
                "time_ms": 0, "message": f"{language} is not installed on this runner."}
    if not _run_lock.acquire(timeout=QUEUE_WAIT_SECONDS):
        return {"status": "busy", "stdout": "", "stderr": "", "compile_output": "", "time_ms": 0,
                "message": "The code runner is busy. Please try again in a moment."}
    try:
        time_limit = max(1.0, min(float(time_limit), 10.0))
        if language == "java":
            return run_java(files, entry, stdin, time_limit)
        return run_javascript(files, entry, stdin, time_limit)
    finally:
        _run_lock.release()
