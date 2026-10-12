import threading
import time
import requests
import uvicorn
from backend.app.main import app

@app.get("/trigger-500")
def trigger_500():
    raise ValueError("Test error")

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8123, log_level="error")

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(2)

response = requests.get("http://127.0.0.1:8123/trigger-500", headers={"Origin": "https://skill-verse-theta.vercel.app"})
print("Status:", response.status_code)
print("Headers:", dict(response.headers))
print("Body:", response.text)
