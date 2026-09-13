import re

with open('frontend/src/pages/session_room.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { formatDate, formatTime } from "../utils/dateTime"' not in content:
    content = content.replace(
        "import { api } from '../api'",
        "import { api } from '../api'\nimport { formatDate, formatTime } from '../utils/dateTime'"
    )

# Fix timer logic
content = re.sub(
    r'const endStr = `\$\{session\.session_date\}T\$\{session\.end_time\}:00`;\s*const endObj = new Date\(endStr\);',
    r'const endObj = new Date(session.scheduled_end);',
    content
)

# Fix session_date rendering
content = re.sub(
    r'formatDate\(session\.session_date\), \{session\.start_time\}',
    r'formatDate(session.scheduled_start || session.session_date), {session.scheduled_start ? formatTime(session.scheduled_start) : session.start_time}',
    content
)

content = re.sub(
    r'formatDate\(session\.session_date\)',
    r'formatDate(session.scheduled_start || session.session_date)',
    content
)

content = re.sub(
    r'>\{session\.start_time\} - \{session\.end_time\}<',
    r'>{session.scheduled_start ? formatTime(session.scheduled_start) : session.start_time} - {session.scheduled_end ? formatTime(session.scheduled_end) : session.end_time}<',
    content
)

# Remove local formatDate
content = re.sub(
    r'function formatDate\(isoDate\).*?return isoDate \}\s*\}',
    r'',
    content,
    flags=re.DOTALL
)

with open('frontend/src/pages/session_room.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
