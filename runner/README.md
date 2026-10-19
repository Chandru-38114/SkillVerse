# SkillVerse code runner

A small, separate web service that compiles and runs **Java 21** and **JavaScript (Node 22)**
for the SkillVerse code editor. Python and SQL run on the main API; this service exists so
that untrusted Java/JS never runs on the server that holds the database password and API keys.

**It holds no secrets.** Its only setting is `RUNNER_TOKEN`, a shared password the main API sends
in the `X-Runner-Token` header.

## Safety
- Java runs with the Security Manager and an empty policy (`sandbox.policy`): no files, no
  environment variables, no network, no starting programs.
- Node runs with `--permission`: it may only read its own temp folder; no child processes.
- Every run: empty environment, CPU limit (6 s), file-size limit, memory flags, 64 KB output cap,
  killed on timeout, and only one run at a time (others wait up to 25 s, then "busy").
- A warm Java compiler (`java/CompileServer.java`) keeps compiling fast on a small free server.

## API
- `GET /health` -> `{"ok": true, "languages": {"java": true, "javascript": true}}`
- `POST /run` (header `X-Runner-Token`) with `{language: "java"|"javascript", files: {name: code}, entry, stdin, time_limit}`
  -> `{status: ok|compile_error|runtime_error|timeout|busy|unavailable, stdout, stderr, compile_output, time_ms}`

## Deploy on Render (free)
New -> Web Service -> same GitHub repo, then:
- Root Directory: `runner`
- Runtime: Python 3
- Build Command: `bash build.sh` (downloads Java 21 + Node 22 into `runner/tools/`)
- Start Command: `bash start.sh`
- Environment: `RUNNER_TOKEN` = a long random value (`python -c "import secrets; print(secrets.token_hex(32))"`)

Then on the main API service set `RUNNER_URL` (this service's https address) and the same `RUNNER_TOKEN`.

Free plan note: Render gives 750 free instance hours a month per workspace, shared by all services.
Two services kept awake all month need about 1,460 hours, so either let the runner sleep (first
Java/JS run after a quiet spell then takes about a minute) or create it in a separate Render workspace.

## Run locally
```bash
cd runner
bash build.sh              # or have java 21 + node 22 on PATH and run: pip install -r requirements.txt
RUNNER_TOKEN=localtoken uvicorn app:app --port 8011
```
and start the API with `RUNNER_URL=http://localhost:8011 RUNNER_TOKEN=localtoken`.

Tests: `python -m pytest runner/tests -q` (from the repo root).
