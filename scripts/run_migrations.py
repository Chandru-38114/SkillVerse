import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))  # repo root
import asyncio
from fastapi import FastAPI
from backend.app.main import lifespan

async def run():
    app = FastAPI()
    async with lifespan(app):
        await asyncio.sleep(2)

asyncio.run(run())
