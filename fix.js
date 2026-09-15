const fs = require('fs');
const files = [
  'frontend/src/pages/messages.jsx',
  'frontend/src/pages/requests.jsx',
  'frontend/src/pages/sessions.jsx',
  'frontend/src/pages/chat.jsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/g, 'getTodayIstYMD()');
  
  if (file.includes('messages.jsx') || file.includes('chat.jsx')) {
    content = content.replace(/import \{ formatDateTime, createIstToUtcDate \} from '\.\.\/utils\/dateTime'/, "import { formatDateTime, createIstToUtcDate, getTodayIstYMD } from '../utils/dateTime'");
  } else if (file.includes('requests.jsx')) {
    content = content.replace(/import \{ createIstToUtcDate, formatDateTime \} from '\.\.\/utils\/dateTime'/, "import { createIstToUtcDate, formatDateTime, getTodayIstYMD } from '../utils/dateTime'");
  } else if (file.includes('sessions.jsx')) {
    content = content.replace(/import \{ formatDateTime \} from '\.\.\/utils\/dateTime'/, "import { formatDateTime, getTodayIstYMD } from '../utils/dateTime'");
  }
  
  fs.writeFileSync(file, content, 'utf8');
});

const dtFile = 'frontend/src/utils/dateTime.js';
let dtContent = fs.readFileSync(dtFile, 'utf8');
dtContent += \n/**\n * Returns today's date in YYYY-MM-DD format, evaluated specifically in IST timezone.\n */\nexport function getTodayIstYMD() {\n  const d = new Date();\n  const options = { timeZone: IST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };\n  // Intl.DateTimeFormat with 'en-CA' gives YYYY-MM-DD format directly\n  return new Intl.DateTimeFormat('en-CA', options).format(d);\n}\n;
fs.writeFileSync(dtFile, dtContent, 'utf8');
