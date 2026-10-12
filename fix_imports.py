import os
import re

files = [
    'frontend/src/pages/messages.jsx',
    'frontend/src/pages/requests.jsx',
    'frontend/src/pages/sessions.jsx',
    'frontend/src/pages/chat.jsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to add getTodayIstYMD to the import block from '../utils/dateTime'
    # It looks like: import { something, something } from '../utils/dateTime'
    
    def replacer(match):
        imports = match.group(1)
        if 'getTodayIstYMD' not in imports:
            imports += ', getTodayIstYMD'
        return f"import {{{imports}}} from '../utils/dateTime'"
        
    content = re.sub(r"import\s+\{([^}]+)\}\s+from\s+'\.\./utils/dateTime'", replacer, content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
