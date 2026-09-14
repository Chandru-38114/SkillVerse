with open('frontend/src/pages/requests.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import { createIstToUtcDate, formatDate } from '../utils/dateTime'\nimport { createIstToUtcDate } from '../utils/dateTime'", "import { createIstToUtcDate, formatDate } from '../utils/dateTime'")

with open('frontend/src/pages/requests.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
