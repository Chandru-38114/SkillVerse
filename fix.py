import os
import re

files = [
    'frontend/src/pages/messages.jsx',
    'frontend/src/pages/requests.jsx',
    'frontend/src/pages/sessions.jsx',
    'frontend/src/pages/chat.jsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace("new Date().toISOString().slice(0, 10)", "getTodayIstYMD()")
    
    if "messages.jsx" in f or "chat.jsx" in f:
        content = content.replace("import { formatDateTime, createIstToUtcDate } from '../utils/dateTime'", "import { formatDateTime, createIstToUtcDate, getTodayIstYMD } from '../utils/dateTime'")
    elif "requests.jsx" in f:
        content = content.replace("import { createIstToUtcDate, formatDateTime } from '../utils/dateTime'", "import { createIstToUtcDate, formatDateTime, getTodayIstYMD } from '../utils/dateTime'")
    elif "sessions.jsx" in f:
        content = content.replace("import { formatDateTime } from '../utils/dateTime'", "import { formatDateTime, getTodayIstYMD } from '../utils/dateTime'")
        
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

dt_file = 'frontend/src/utils/dateTime.js'
with open(dt_file, 'a', encoding='utf-8') as file:
    file.write('''
/**
 * Returns today's date in YYYY-MM-DD format, evaluated specifically in IST timezone.
 */
export function getTodayIstYMD() {
  const d = new Date();
  const options = { timeZone: IST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };
  // Intl.DateTimeFormat with 'en-CA' gives YYYY-MM-DD format directly
  return new Intl.DateTimeFormat('en-CA', options).format(d);
}
''')
