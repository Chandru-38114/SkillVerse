import re

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'import { formatTime, formatDate, formatDateTime, createIstToUtcDate } from "../utils/dateTime"' not in content:
    content = content.replace(
        "import { api } from '../api'",
        "import { api } from '../api'\nimport { formatTime, formatDate, formatDateTime, createIstToUtcDate } from '../utils/dateTime'"
    )

# Fix Session Tag format (using scheduled_start instead of session_date and session_time)
content = re.sub(
    r'Session: \{formatTime\(activeConversation\.session_date\)\} \{activeConversation\.session_time\}',
    r'Session: {activeConversation.session_date ? (activeConversation.scheduled_start ? formatDateTime(activeConversation.scheduled_start) : `${activeConversation.session_date} ${activeConversation.session_time}`) : ""}',
    content
)

# Fix API createSession
content = re.sub(
    r'request_id: selectedRequestId,\s*session_date: scheduleData\.date,\s*start_time: scheduleData\.startTime,\s*end_time: scheduleData\.endTime,',
    r'''request_id: selectedRequestId,
        scheduled_start: createIstToUtcDate(scheduleData.date, scheduleData.startTime).toISOString(),
        scheduled_end: createIstToUtcDate(scheduleData.date, scheduleData.endTime).toISOString(),''',
    content
)

# Fix new Date(m.created_at).toLocaleTimeString...
content = re.sub(
    r'\{new Date\(m\.created_at\)\.toLocaleTimeString\(\[\], \{ hour: \'2-digit\', minute: \'2-digit\' \}\)\}',
    r'{formatTime(m.created_at)}',
    content
)

# Remove local formatTime function entirely
content = re.sub(
    r'function formatTime\(dateStr\)\s*\{\s*const d = new Date\(dateStr\).*?\}\s*return d\.toLocaleDateString\(\[\], \{ month: \'short\', day: \'numeric\' \}\)\s*\}',
    r'',
    content,
    flags=re.DOTALL
)

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
