import time, sys
print("Importing app...", flush=True)
time.sleep(5)
print("Import done.", flush=True)
from fastapi import FastAPI
app = FastAPI()
