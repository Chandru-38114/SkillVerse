import re

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add ArrowLeft, Paperclip, Calendar, ImageIcon, FileIcon to lucide-react imports
if 'import { Hand, MessageCircle } from \'lucide-react\'' in content:
    content = content.replace(
        "import { Hand, MessageCircle } from 'lucide-react'",
        "import { Hand, MessageCircle, ArrowLeft, Paperclip, Calendar, Image as ImageIcon, File as FileIcon } from 'lucide-react'"
    )
elif 'lucide-react' in content:
    # generic replacement if the exact string isn't matched
    content = re.sub(
        r"import\s+\{([^}]+)\}\s+from\s+['\"]lucide-react['\"]",
        lambda m: f"import {{{m.group(1)}, ArrowLeft, Paperclip, Calendar, Image as ImageIcon, File as FileIcon}} from 'lucide-react'",
        content
    )

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
