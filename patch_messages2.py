import os
import re

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'src=\{\\$\{BACKEND_URL\}\$\{([^}]+)\}\\}', r'src={getAvatarUrl(\1)}', code)

if 'getAvatarUrl' not in code:
    code = code.replace('import api from "../api";', 'import api, { getAvatarUrl } from "../api";')

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched messages.jsx with regex")
