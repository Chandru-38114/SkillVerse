with open("frontend/src/pages/forgot_password.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("</div>\n      </div>\n      </div>\n    </div>\n  )\n}", "</div>\n      </div>\n    </div>\n  )\n}")

# Fix SkillVerseLogo injection properly
import re
content = content.replace("import { Link } from 'react-router-dom'", "import { Link } from 'react-router-dom'\nimport SkillVerseLogo from '../components/SkillVerseLogo'")
content = re.sub(r'<div className="mb-8 text-center">.*?<p className="text-ink/50 text-sm mt-1">.*?</div>', '<SkillVerseLogo />\n          <div className="mb-6 text-center"><p className="text-ink/50 text-sm">Password Recovery</p></div>', content, flags=re.DOTALL)

with open("frontend/src/pages/forgot_password.jsx", "w", encoding="utf-8") as f:
    f.write(content)
