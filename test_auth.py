from backend.app.schemas import UserOut
from backend.app.models import User
from backend.app.database import SessionLocal
db = SessionLocal()
u = db.query(User).first()
if u:
    try:
        out = UserOut.model_validate(u)
        print("Success:", out.model_dump())
    except Exception as e:
        print("Exception:", e)
else:
    print("No users in DB")
