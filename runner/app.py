"""
SkillVerse code runner: a tiny web service that runs Java and JavaScript.

It is deployed SEPARATELY from the main API and holds no secrets except
RUNNER_TOKEN (the password the main API sends). Even if someone's code escaped
every lock, there would be no database, no user data and no API keys to find.

  GET  /health   -> {"ok": true, "languages": {...}}
  POST /run      -> header X-Runner-Token, body {language, files, entry, stdin, time_limit}
"""
import hmac
import os
import threading
from typing import Dict

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

import executor

app = FastAPI(title="SkillVerse code runner", docs_url=None, redoc_url=None, openapi_url=None)
TOKEN = os.environ.get("RUNNER_TOKEN", "")


class RunRequest(BaseModel):
    language: str = Field(..., pattern="^(java|javascript)$")
    files: Dict[str, str] = Field(..., max_length=6)
    entry: str = Field(..., max_length=100)
    stdin: str = Field("", max_length=65_000)
    time_limit: float = 5.0


@app.on_event("startup")
def _warm():
    threading.Thread(target=executor.warm_up, daemon=True).start()


@app.get("/health")
def health():
    return {"ok": True, "languages": executor.available()}


@app.post("/run")
def run(req: RunRequest, x_runner_token: str = Header(default="")):
    if not TOKEN or not hmac.compare_digest(x_runner_token, TOKEN):
        raise HTTPException(status_code=401, detail="Bad runner token")
    if sum(len(v) for v in req.files.values()) > 120_000:
        raise HTTPException(status_code=413, detail="Code too long")
    return executor.execute(req.language, req.files, req.entry, req.stdin, req.time_limit)
