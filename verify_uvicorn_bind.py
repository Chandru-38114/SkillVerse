import asyncio
import socket
import time
import subprocess
import sys
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[app] Lifespan starting. Sleeping 10s...", flush=True)
    await asyncio.sleep(10)
    print("[app] Lifespan finished.", flush=True)
    yield

app = FastAPI(lifespan=lifespan)
