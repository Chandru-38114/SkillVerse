import re

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

emojis = "['\\U0001f44d', '\\u2764\\ufe0f', '\\U0001f602', '\\U0001f525', '\\U0001f389']"

content = re.sub(r"const REACTION_EMOJIS = \[[^\]]*\]", f"const REACTION_EMOJIS = {emojis}", content)
content = re.sub(r"const COMPOSE_EMOJIS = \[[^\]]*\]", f"const COMPOSE_EMOJIS = {emojis}", content)

# Remove the mojibake comment lines
content = re.sub(r"//\s*(A[\x80-\xff,?\~A]+)+\s*Reactions display.*", "// ── Reactions display ──", content)
content = re.sub(r"//\s*(A[\x80-\xff,?\~A]+)+\s*Utilities.*", "// ── Utilities ──", content)
content = re.sub(r"//\s*(A[\x80-\xff,?\~A]+)+.*", "// ── Component ──", content)

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
