import re

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    m = f.read()

m = m.replace('onClick={() => onToggle(messageId, emoji)}', 'onClick={() => onToggle(messageId, reactionKey)}')
m = m.replace('>{em}<', '>{em.emoji}<')
m = m.replace('>{em}</button>', '>{em.emoji}</button>')
m = m.replace('{em}\n                      </button>', '{em.emoji}\n                      </button>')

# For COMPOSE_EMOJIS, remove it and use REACTION_EMOJIS
m = m.replace("const COMPOSE_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉']", "")
m = m.replace("COMPOSE_EMOJIS", "REACTION_EMOJIS")

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(m)
