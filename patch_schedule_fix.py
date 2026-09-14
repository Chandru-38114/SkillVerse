import re

# 1. Patch chat.jsx
with open('frontend/src/pages/chat.jsx', 'r', encoding='utf-8') as f:
    chat_content = f.read()

if 'createIstToUtcDate' not in chat_content:
    chat_content = re.sub(
        r"import \{ formatTime \} from '\.\./utils/dateTime'",
        r"import { formatTime, createIstToUtcDate } from '../utils/dateTime'",
        chat_content
    )

chat_content = re.sub(
    r'(await api\.createSession\(\{\s*request_id:\s*requestId,\s*session_date:\s*scheduleData\.date,\s*start_time:\s*scheduleData\.startTime,\s*end_time:\s*scheduleData\.endTime,)',
    r'\1\n          scheduled_start: createIstToUtcDate(scheduleData.date, scheduleData.startTime).toISOString(),\n          scheduled_end: createIstToUtcDate(scheduleData.date, scheduleData.endTime).toISOString(),',
    chat_content
)

with open('frontend/src/pages/chat.jsx', 'w', encoding='utf-8') as f:
    f.write(chat_content)

# 2. Patch requests.jsx
with open('frontend/src/pages/requests.jsx', 'r', encoding='utf-8') as f:
    req_content = f.read()

if 'createIstToUtcDate' not in req_content:
    req_content = re.sub(
        r"import \{ api \} from '\.\./api'",
        r"import { api } from '../api'\nimport { createIstToUtcDate } from '../utils/dateTime'",
        req_content
    )

req_content = re.sub(
    r'(const created = await api\.createSession\(\{\s*request_id:\s*requestId,\s*session_date:\s*date,\s*start_time:\s*start,\s*end_time:\s*end,)',
    r'\1\n          scheduled_start: createIstToUtcDate(date, start).toISOString(),\n          scheduled_end: createIstToUtcDate(date, end).toISOString(),',
    req_content
)

with open('frontend/src/pages/requests.jsx', 'w', encoding='utf-8') as f:
    f.write(req_content)

print("Patched both files.")
