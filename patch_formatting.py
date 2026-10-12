import re

# 1. messages.jsx
with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    msgs = f.read()
if 'from \'../utils/dateTime\'' not in msgs:
    msgs = re.sub(
        r"(import React.*?from 'react'.*?\n)",
        r"\1import { formatTime, formatDateTime, createIstToUtcDate } from '../utils/dateTime'\n",
        msgs, count=1
    )
with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(msgs)


# 2. session_room.jsx
with open('frontend/src/pages/session_room.jsx', 'r', encoding='utf-8') as f:
    sroom = f.read()
if 'from \'../utils/dateTime\'' not in sroom:
    sroom = re.sub(
        r"(import \{ useState, useEffect \} from 'react'.*?\n)",
        r"\1import { formatDate, formatTime } from '../utils/dateTime'\n",
        sroom, count=1
    )
    # Fix line 179: {formatDate(session.scheduled_start || session.session_date)}, {session.start_time}
    sroom = re.sub(
        r"\{formatDate\(session\.scheduled_start \|\| session\.session_date\)\}, \{session\.start_time\}",
        r"{formatDate(session.scheduled_start || session.session_date)}, {session.scheduled_start ? formatTime(session.scheduled_start) : session.start_time}",
        sroom
    )
with open('frontend/src/pages/session_room.jsx', 'w', encoding='utf-8') as f:
    f.write(sroom)


# 3. sessions.jsx
with open('frontend/src/pages/sessions.jsx', 'r', encoding='utf-8') as f:
    sess = f.read()

# Add import if missing
if 'from \'../utils/dateTime\'' not in sess:
    sess = re.sub(
        r"(import \{ useEffect, useState \} from 'react'.*?\n)",
        r"\1import { formatDate, formatTime } from '../utils/dateTime'\n",
        sess, count=1
    )
# Remove the local formatDate function
sess = re.sub(r"function formatDate\(isoDate\) \{.*?return d\.toLocaleDateString\(\[\], \{ weekday: 'short', month: 'short', day: 'numeric' \}\)\n\}", "", sess, flags=re.DOTALL)
# It exported formatDate at the bottom: export { SessionCard, SessionStatusPill, formatDate }
sess = sess.replace("export { SessionCard, SessionStatusPill, formatDate }", "export { SessionCard, SessionStatusPill }")
with open('frontend/src/pages/sessions.jsx', 'w', encoding='utf-8') as f:
    f.write(sess)


# 4. requests.jsx
with open('frontend/src/pages/requests.jsx', 'r', encoding='utf-8') as f:
    reqs = f.read()

# Make sure formatDate is imported
if 'formatDate' not in reqs:
    reqs = reqs.replace(
        "import { createIstToUtcDate } from '../utils/dateTime'",
        "import { createIstToUtcDate, formatDate } from '../utils/dateTime'"
    )
# Replace formatSessionDate with formatDate
reqs = reqs.replace("formatSessionDate(session.session_date)", "formatDate(session.scheduled_start || session.session_date)")
# Remove the local formatSessionDate function
reqs = re.sub(r"function formatSessionDate\(isoDate\) \{.*?\}\n", "", reqs, flags=re.DOTALL)

with open('frontend/src/pages/requests.jsx', 'w', encoding='utf-8') as f:
    f.write(reqs)

print("Frontend formatting patches applied.")
