import re
with open('frontend/src/pages/chat.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import { COMMON_EMOJIS } from "../utils/emojis";', 'const COMMON_EMOJIS = ["👍","👎","❤️","🔥","✨","✅","👀","💯","🎉","😂","🙏","🚀","💡","🤷","👏","😅","🙌","😎","😭","🤝"];\n')

with open('frontend/src/pages/chat.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
