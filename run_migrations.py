import asyncio
from fastapi import FastAPI
from backend.app.main import lifespan

async def run():
    app = FastAPI()
    async with lifespan(app):
        await asyncio.sleep(2)

asyncio.run(run())
