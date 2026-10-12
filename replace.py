import sys  
content = open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8').read()  
content = content.replace('const REACTION_EMOJIS = [\'??\', \'??\', \'??\', \'??\', \'??\']', 'import { REACTION_EMOJIS, getEmojiForKey } from \'../utils/emojis\'')  
open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8').write(content)  
