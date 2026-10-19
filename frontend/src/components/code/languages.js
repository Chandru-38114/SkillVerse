// Languages the SkillVerse editor offers, and their "Hello" starters.
export const LANGUAGE_LABELS = {
  python: 'Python 3',
  java: 'Java 21',
  javascript: 'JavaScript',
  sql: 'SQL (SQLite)',
  web: 'HTML / CSS / JS',
}

export const HELLO = {
  python: 'name = input("Your name: ")\nprint(f"Hello, {name}!")\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String name = sc.hasNextLine() ? sc.nextLine() : "SkillVerse";\n        System.out.println("Hello, " + name + "!");\n    }\n}\n',
  javascript: "const input = require('fs').readFileSync(0, 'utf8').trim();\nconsole.log(`Hello, ${input || 'SkillVerse'}!`);\n",
  sql: "-- A fresh practice database for every run\nCREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, score INTEGER);\nINSERT INTO students VALUES (1, 'Asha', 91), (2, 'Ravi', 78), (3, 'Meena', 85);\n\nSELECT name, score FROM students ORDER BY score DESC;\n",
  web: JSON.stringify({
    html: '<h1>Hello, SkillVerse!</h1>\n<button id="btn">Click me</button>\n<p id="out"></p>\n',
    css: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 24px;\n  background: #FFFDF8;\n}\n\nh1 {\n  color: #FF8A3D;\n}\n',
    js: "let clicks = 0;\ndocument.getElementById('btn').addEventListener('click', () => {\n  clicks++;\n  document.getElementById('out').textContent = `Clicked ${clicks} time(s)`;\n  console.log('clicks:', clicks);\n});\n",
  }),
}

// Languages that read the "Input" box (stdin).
export const USES_STDIN = new Set(['python', 'java', 'javascript'])

export function parseWeb(code) {
  try {
    const v = JSON.parse(code)
    if (v && typeof v === 'object') return { html: v.html || '', css: v.css || '', js: v.js || '' }
  } catch { /* not a web workspace yet */ }
  return { html: '', css: '', js: '' }
}
