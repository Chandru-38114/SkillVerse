import re

# 1. sessions.jsx
with open('frontend/src/pages/sessions.jsx', 'r', encoding='utf-8') as f:
    sess = f.read()

# Add import if missing
if 'from \'../utils/dateTime\'' not in sess:
    sess = re.sub(
        r"(import \{ useEffect, useState \} from 'react'.*?\n)",
        r"\1import { formatDate, formatTime } from '../utils/dateTime'\n",
        sess, count=1
    )

# Remove the exact local formatDate function
to_remove_sess = """function formatDate(isoDate) {
  try {
    // Parse as local date to avoid UTC offset day shift
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return isoDate
  }
}"""
sess = sess.replace(to_remove_sess, "")

# Remove from exports
sess = sess.replace("export { SessionCard, SessionStatusPill, formatDate }", "export { SessionCard, SessionStatusPill }")

with open('frontend/src/pages/sessions.jsx', 'w', encoding='utf-8') as f:
    f.write(sess)

# 2. requests.jsx
with open('frontend/src/pages/requests.jsx', 'r', encoding='utf-8') as f:
    reqs = f.read()

# Make sure formatDate and createIstToUtcDate are imported
if 'formatDate' not in reqs:
    reqs = "import { createIstToUtcDate, formatDate } from '../utils/dateTime'\n" + reqs

# Replace formatSessionDate usage with formatDate
reqs = reqs.replace("formatSessionDate(session.session_date)", "formatDate(session.scheduled_start || session.session_date)")

# Remove the local formatSessionDate function
to_remove_reqs = """function formatSessionDate(isoDate) {
  try {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return isoDate }
}"""
reqs = reqs.replace(to_remove_reqs, "")

with open('frontend/src/pages/requests.jsx', 'w', encoding='utf-8') as f:
    f.write(reqs)

print("Safely patched sessions.jsx and requests.jsx")
