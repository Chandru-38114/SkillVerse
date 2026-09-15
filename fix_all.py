import re

# ------------- Fix VideoChat.jsx -------------
with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix the double closing brace in import
c = c.replace("} , User } from 'lucide-react'", ", User } from 'lucide-react'")

# Fix the emoji render
c = c.replace('{emoji}\n                </button>', '{em.emoji}\n                </button>')

# Fix the rendering of emoji in activeEmojis 
# wait, my previous script did: c = c.replace('>{e.emoji}<', '>{getEmojiForKey(e.emoji)}<')
# Let's check if it did it correctly:
if '{getEmojiForKey(e.emoji)}' not in c:
    c = c.replace('{e.emoji}', '{getEmojiForKey(e.emoji)}')

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(c)


# ------------- Fix messages.jsx -------------
with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    m = f.read()

# Add import
if 'REACTION_EMOJIS' not in m or 'import ' not in m.split('REACTION_EMOJIS')[0]:
    m = m.replace("const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉']", "import { REACTION_EMOJIS, getEmojiForKey } from '../utils/emojis'")

# Fix reactions map
m = re.sub(r'Object\.entries\(reactions\)\.map\(\(\[emoji, users\]\) =>', 'Object.entries(reactions).map(([reactionKey, users]) =>', m)
m = m.replace('key={emoji}', 'key={reactionKey}')
m = m.replace('>{emoji}<', '>{getEmojiForKey(reactionKey) || reactionKey}<')
m = m.replace('{emoji} ', '{getEmojiForKey(reactionKey) || reactionKey} ')

# Fix REACTION_EMOJIS loop
m = m.replace('key={em}', 'key={em.key}')
m = m.replace('onToggleReaction(m.id, em)', 'onToggleReaction(m.id, em.key)')
m = m.replace('>{em}<', '>{em.emoji}<')

# Clean up corrupted headers
m = re.sub(r'// [^\n]+Reactions display[^\n]*\n', '// Reactions display\n', m)
m = re.sub(r'// [^\n]+Reply Preview[^\n]*\n', '// Reply Preview\n', m)
m = re.sub(r'// [^\n]+Edit / Forward[^\n]*\n', '// Edit / Forward\n', m)

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(m)

