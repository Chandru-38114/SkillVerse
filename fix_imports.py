import re

def fix_imports(filepath, new_import):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if new_import not in content:
        # Just insert it after the React import
        content = re.sub(
            r"(import React.*?from 'react'.*?\n)",
            r"\1" + new_import + "\n",
            content,
            count=1
        )
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed imports for {filepath}")

fix_imports('frontend/src/pages/chat.jsx', "import { formatTime, createIstToUtcDate } from '../utils/dateTime'")
fix_imports('frontend/src/pages/requests.jsx', "import { createIstToUtcDate } from '../utils/dateTime'")
