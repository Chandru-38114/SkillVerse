import re
with open('frontend/src/pages/chat.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'const COMMON_EMOJIS = \[.*?\]\s*', '', text, flags=re.DOTALL)

with open('frontend/src/pages/chat.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
