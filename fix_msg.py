import re

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix REACTION_EMOJIS
content = re.sub(r"const REACTION_EMOJIS = \[[^\]]*\]", "const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉']", content)
content = re.sub(r"const COMPOSE_EMOJIS = \[[^\]]*\]", "const COMPOSE_EMOJIS = ['👍', '😊', '❤️', '🙏', '😂', '🔥', '🎉']", content)

# Remove the mojibake comment lines
content = re.sub(r"//\s*(A[\x80-\xff,?\~A]+)+\s*Reactions display.*", "// ── Reactions display ──", content)
content = re.sub(r"//\s*(A[\x80-\xff,?\~A]+)+\s*Utilities.*", "// ── Utilities ──", content)
content = re.sub(r"//\s*(A[\x80-\xff,?\~A]+)+.*", "// ── Component ──", content)

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
