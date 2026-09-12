with open("backend/app/schemas.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "is_mobile_verified: bool = False\n    college: str",
    "is_mobile_verified: bool = False\n    college: str\n    dob: Optional[dt.date] = None\n    gender: Optional[str] = None\n    age: Optional[int] = None"
)

with open("backend/app/schemas.py", "w", encoding="utf-8") as f:
    f.write(content)
