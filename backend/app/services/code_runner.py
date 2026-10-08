import os
import sys
import tempfile
import subprocess

SANDBOX_SCRIPT = os.path.join(os.path.dirname(__file__), '..', 'sandbox.py')
MAX_OUTPUT_CHARS = 20000


def _limit_resources():  # runs in the child process before the sandbox starts (Linux only)
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))  # 256 MB memory
    resource.setrlimit(resource.RLIMIT_CPU, (3, 3))                                   # 3 s CPU
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))             # no big files
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def run_python(code: str, timeout: float = 4.0) -> dict:
    """Run untrusted Python in the sandbox with an empty environment and hard limits.
    The child never sees DATABASE_URL, GEMINI_API_KEY or any other server secret."""
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as temp_file:
            temp_file.write(code)
            temp_path = temp_file.name
        result = subprocess.run(
            [sys.executable, '-I', '-S', SANDBOX_SCRIPT, temp_path],  # isolated mode, no site-packages
            capture_output=True,
            text=True,
            timeout=timeout,
            env={},
            preexec_fn=_limit_resources if os.name == 'posix' else None,
        )
        output = result.stdout[:MAX_OUTPUT_CHARS]
        error = result.stderr[:MAX_OUTPUT_CHARS] if result.returncode != 0 else None
        if result.returncode != 0 and not error:
            error = "Execution Error: the program was stopped (memory or CPU limit exceeded)."
        return {"output": output, "error": error}
    except subprocess.TimeoutExpired:
        return {"output": "", "error": "Execution Error: Code exceeded the time limit."}
    except Exception as e:
        return {"output": "", "error": f"System Error: Could not execute code. {str(e)}"}
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
