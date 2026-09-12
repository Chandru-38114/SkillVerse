import os
import re

files = [
    'frontend/src/components/navbar.jsx',
    'frontend/src/pages/dashboard.jsx',
    'frontend/src/pages/marketplace.jsx',
    'frontend/src/pages/session_room.jsx'
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            code = f.read()
        if 'getAvatarUrl' in code and 'import { getAvatarUrl }' not in code and 'import api, { getAvatarUrl }' not in code:
            if 'import { BASE_URL' in code:
                code = re.sub(r'import {([^}]*?)BASE_URL([^}]*?)} from ["\'](\.\./)*api["\'];?', r'import {\1BASE_URL, getAvatarUrl\2} from "\3api";', code)
            elif 'import api' in code:
                code = code.replace('import api', 'import api, { getAvatarUrl }')
            else:
                code = 'import { getAvatarUrl } from "../api";\n' + code
                
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(code)
            print(f"Added import to {filepath}")
