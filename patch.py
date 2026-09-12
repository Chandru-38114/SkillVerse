import re

with open('frontend/src/pages/login.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace any run of non-alphanumeric chars inside placeholder that starts with ? or weird char
code = re.sub(r'placeholder="[^A-Za-z0-9]+"', 'placeholder="********"', code)

with open('frontend/src/pages/login.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("login patched")
