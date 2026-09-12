from fastapi import FastAPI
from contextlib import asynccontextmanager
import time
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Lifespan started, sleeping for 10s...")
    await asyncio.sleep(10)
    print("Lifespan done.")
    yield

app = FastAPI(lifespan=lifespan)
