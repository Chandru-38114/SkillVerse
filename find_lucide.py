import re
with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'import \{.*?\} from [\'"]lucide-react[\'"]', text, re.DOTALL)
if match:
    print(match.group(0))
