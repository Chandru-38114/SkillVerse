import re

with open('backend/app/routers/auth.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(@router\.post\("/google", response_model=schemas\.Token\)\ndef google_auth.*?)(^\s*except ValueError as e:\n\s*print\(f"\[GOOGLE AUTH\] Token verification failed: \{e\}"\)\n\s*raise HTTPException\(status_code=401, detail=f"Invalid Google token: \{str\(e\)\}"\))', re.DOTALL | re.MULTILINE)

# The goal is to append a catch-all exception block.
replacement = r'\1\2\n    except Exception as e:\n        import traceback\n        traceback.print_exc()\n        print(f"[GOOGLE AUTH] Unexpected error: {e}")\n        raise HTTPException(status_code=500, detail=f"Unexpected error during Google authentication: {str(e)}")'

new_content = pattern.sub(replacement, content)

with open('backend/app/routers/auth.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("auth.py patched with catch-all")
