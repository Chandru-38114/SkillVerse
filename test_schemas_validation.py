import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.schemas import MessageCreate

# 1. MessageCreate(content="hello") succeeds.
mc1 = MessageCreate(content="hello")
print(f"mc1: {mc1.model_dump()}")

# 2. MessageCreate(content="hello", metadata={...}) succeeds.
mc2 = MessageCreate(content="hello", metadata={"reply_to_id": 123})
print(f"mc2: {mc2.model_dump()}")

print("Pydantic validation tests passed.")
