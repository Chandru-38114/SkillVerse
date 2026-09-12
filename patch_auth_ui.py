import re

# Update login.jsx
with open("frontend/src/pages/login.jsx", "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace("import { useNavigate, Link } from 'react-router-dom'", "import { useNavigate, Link } from 'react-router-dom'\nimport SkillVerseLogo from '../components/SkillVerseLogo'")
content = re.sub(r'<div className="mb-8 text-center">.*?<p className="text-ink/50 text-sm mt-1">.*?</div>', '<SkillVerseLogo />\n        <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Welcome back</p></div>', content, flags=re.DOTALL)
with open("frontend/src/pages/login.jsx", "w", encoding="utf-8") as f:
    f.write(content)

# Update signup.jsx
with open("frontend/src/pages/signup.jsx", "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace("import { useNavigate, Link } from 'react-router-dom'", "import { useNavigate, Link } from 'react-router-dom'\nimport SkillVerseLogo from '../components/SkillVerseLogo'")
content = re.sub(r'<div className="mb-8 text-center">.*?<p className="text-ink/50 text-sm mt-1">.*?</div>', '<SkillVerseLogo />\n        <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Create your profile</p></div>', content, flags=re.DOTALL)
with open("frontend/src/pages/signup.jsx", "w", encoding="utf-8") as f:
    f.write(content)

# Update verify_email.jsx
with open("frontend/src/pages/verify_email.jsx", "r", encoding="utf-8") as f:
    content = f.read()
if "SkillVerseLogo" not in content:
    content = content.replace("import { useNavigate } from 'react-router-dom'", "import { useNavigate } from 'react-router-dom'\nimport SkillVerseLogo from '../components/SkillVerseLogo'")
    content = content.replace('<div className="w-full max-w-md card p-8 text-center">', '<div className="w-full max-w-md">\n        <SkillVerseLogo />\n        <div className="card p-8 text-center">')
    content = content.replace('</div>\n    </div>\n  )\n}', '</div>\n      </div>\n    </div>\n  )\n}')
with open("frontend/src/pages/verify_email.jsx", "w", encoding="utf-8") as f:
    f.write(content)

# Update verify_mobile.jsx
with open("frontend/src/pages/verify_mobile.jsx", "r", encoding="utf-8") as f:
    content = f.read()
if "SkillVerseLogo" not in content:
    content = content.replace("import { useNavigate } from 'react-router-dom'", "import { useNavigate } from 'react-router-dom'\nimport SkillVerseLogo from '../components/SkillVerseLogo'")
    content = content.replace('<div className="w-full max-w-md card p-8 text-center">', '<div className="w-full max-w-md">\n        <SkillVerseLogo />\n        <div className="card p-8 text-center">')
    content = content.replace('</div>\n    </div>\n  )\n}', '</div>\n      </div>\n    </div>\n  )\n}')
with open("frontend/src/pages/verify_mobile.jsx", "w", encoding="utf-8") as f:
    f.write(content)

# Update forgot_password.jsx
with open("frontend/src/pages/forgot_password.jsx", "r", encoding="utf-8") as f:
    content = f.read()
if "SkillVerseLogo" not in content:
    content = content.replace("import { Link } from 'react-router-dom'", "import { Link } from 'react-router-dom'\nimport SkillVerseLogo from '../components/SkillVerseLogo'")
    content = content.replace('<div className="w-full max-w-md card p-8">', '<div className="w-full max-w-md">\n        <SkillVerseLogo />\n        <div className="card p-8">')
    content = content.replace('</div>\n    </div>\n  )\n}', '</div>\n      </div>\n    </div>\n  )\n}')
with open("frontend/src/pages/forgot_password.jsx", "w", encoding="utf-8") as f:
    f.write(content)

