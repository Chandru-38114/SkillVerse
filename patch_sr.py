import re

with open('frontend/src/pages/session_room.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Import BackButton
if 'import BackButton' not in content:
    content = content.replace("import { Link, useParams, useNavigate } from 'react-router-dom'", 
                              "import { Link, useParams, useNavigate } from 'react-router-dom'\nimport BackButton from '../components/BackButton'")

# Replace the Link to Home with BackButton to sessions
link_str = """          <div className="flex items-center gap-2.5 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0" title="SkillVerse Home">
              <div className="w-7 h-7 rounded-full bg-brandLight/50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="hidden sm:block font-display text-base font-bold tracking-tight text-ink">Skill<span className="text-brand">Verse</span></span>
            </Link>"""

replacement_str = """          <div className="flex items-center gap-2.5 min-w-0">
            <BackButton to="/sessions" className="shrink-0" />
            <div className="hidden sm:flex items-center gap-2 shrink-0" title="SkillVerse Home">
              <span className="font-display text-base font-bold tracking-tight text-ink ml-1">Skill<span className="text-brand">Verse</span></span>
            </div>"""

content = content.replace(link_str, replacement_str)

with open('frontend/src/pages/session_room.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
