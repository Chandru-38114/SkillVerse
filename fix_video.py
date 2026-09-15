import re

with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Add REACTION_EMOJIS import if not present
if 'REACTION_EMOJIS' not in c:
    c = c.replace("import { useNavigate } from 'react-router-dom'", 
                  "import { useNavigate } from 'react-router-dom'\nimport { REACTION_EMOJIS, getEmojiForKey } from '../utils/emojis'")

# Replace the hardcoded array
c = re.sub(r'\[\s*[\'"].*?[\'"]\s*(?:,\s*[\'"].*?[\'"]\s*)*\]\.map\(emoji =>', 'REACTION_EMOJIS.map(em =>', c)
c = c.replace('key={emoji}', 'key={em.key}')
c = c.replace('sendReaction(emoji)', 'sendReaction(em.key)')
c = c.replace('>{emoji}<', '>{em.emoji}<')

c = c.replace('>{e.emoji}<', '>{getEmojiForKey(e.emoji)}<')

# Fix corrupted strings
c = c.replace('>âœ‹<', '><Hand size={14} /><')
c = c.replace('âœ‹ Hand Raised', '<Hand size={18} /> Hand Raised')
c = c.replace('>ðŸ”‡<', '><MicOff size={16} /><')
c = c.replace('>ðŸŽ™ï¸ <', '><Mic size={16} /><')
c = c.replace('>ðŸš«<', '><VideoOff size={16} /><')
c = c.replace('>ðŸ“·<', '><Video size={16} /><')
c = c.replace('ðŸ‘¤', '<User size={32} />')
c = c.replace('from \'lucide-react\'', ', User } from \'lucide-react\'')

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
