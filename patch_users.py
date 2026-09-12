with open("backend/app/routers/users.py", "r", encoding="utf-8") as f:
    content = f.read()

patch = """    if auth.verify_password(req.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="You are entering your old password. Please choose a different password.")
        
    try:"""

content = content.replace("    try:\n        auth.validate_password_strength(req.new_password)", patch + "\n        auth.validate_password_strength(req.new_password)")

with open("backend/app/routers/users.py", "w", encoding="utf-8") as f:
    f.write(content)
