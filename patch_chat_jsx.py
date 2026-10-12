import re

# Notice: I am patching frontend/src/components/chat.jsx because the code shows up there
# Wait, let me check the path from the previous run command. It was frontend/src/pages/chat.jsx.
# Wait! I ran 'cat frontend/src/pages/chat.jsx' and it returned output, so the file is indeed frontend/src/pages/chat.jsx. Wait, no, earlier we had chat.jsx in pages or components?
# The `cat frontend/src/pages/chat.jsx` succeeded.

with open('frontend/src/pages/chat.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { formatTime } from "../utils/dateTime"' not in content:
    content = content.replace(
        "import { api } from '../api'",
        "import { api } from '../api'\nimport { formatTime } from '../utils/dateTime'"
    )

content = re.sub(
    r'new Date\(m\.created_at\)\.toLocaleTimeString\(\[\], \{ hour: \'2-digit\', minute: \'2-digit\' \}\)',
    r'formatTime(m.created_at)',
    content
)

with open('frontend/src/pages/chat.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
