with open('frontend/src/pages/requests.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if "import { createIstToUtcDate } from '../utils/dateTime'" not in content:
    content = "import { createIstToUtcDate } from '../utils/dateTime'\n" + content

with open('frontend/src/pages/requests.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
