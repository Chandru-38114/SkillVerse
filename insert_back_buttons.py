import re
import os

pages = [
    ('frontend/src/pages/profile.jsx', 'import BackButton from "../components/BackButton";\n', '<div className="max-w-4xl mx-auto space-y-6">', '<div className="max-w-4xl mx-auto space-y-6">\n        <BackButton className="mb-4" />'),
    ('frontend/src/pages/marketplace.jsx', 'import BackButton from "../components/BackButton";\n', '<div className="max-w-7xl mx-auto">', '<div className="max-w-7xl mx-auto">\n        <BackButton className="mb-4" />'),
    ('frontend/src/pages/assessment.jsx', 'import BackButton from "../components/BackButton";\n', '<div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-line">', '<div className="max-w-3xl mx-auto"><BackButton className="mb-4" /><div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-line">'),
    ('frontend/src/pages/progress.jsx', 'import BackButton from "../components/BackButton";\n', '<div className="max-w-5xl mx-auto">', '<div className="max-w-5xl mx-auto">\n        <BackButton className="mb-4" />'),
    ('frontend/src/pages/sessions.jsx', 'import BackButton from "../components/BackButton";\n', '<div className="max-w-6xl mx-auto">', '<div className="max-w-6xl mx-auto">\n        <BackButton className="mb-4" />'),
]

for path, import_str, old_str, new_str in pages:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Avoid duplicate imports
        if "BackButton" not in content:
            # Insert import after first line
            content = re.sub(r'^(import .*?\n)', r'\1' + import_str, content, count=1)
            # Insert back button
            content = content.replace(old_str, new_str)
            
            # Special case for assessment.jsx closing div
            if path == 'frontend/src/pages/assessment.jsx':
                content = content.replace("</div>\n    </div>\n  );\n}", "</div>\n      </div>\n    </div>\n  );\n}")
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {path}")
    else:
        print(f"File not found {path}")
