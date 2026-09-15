import re

with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Lucide imports
if 'lucide-react' not in content:
    content = re.sub(r"import \{ getSessionUser \} from '\.\./api'", "import { getSessionUser } from '../api'\nimport { Mic, MicOff, Video, VideoOff, Hand, Smile } from 'lucide-react'", content)

# Fix mic button
content = content.replace("{isMuted ? 'dY\"' : 'dYZT,?'}", "{isMuted ? <MicOff size={18} /> : <Mic size={18} />}")
content = content.replace("{isMuted ? 'dY\"' : 'dYZT,?'}", "{isMuted ? <MicOff size={18} /> : <Mic size={18} />}") # just in case of slight mojibake difference, actually regex is safer.

content = re.sub(r"\{isMuted \? '.*?' : '.*?'\}", "{isMuted ? <MicOff size={18} /> : <Mic size={18} />}", content)

# Fix video button
content = re.sub(r"\{isVideoOff \? '.*?' : '.*?'\}", "{isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}", content)

# Fix hand button
content = re.sub(r">\s*o<\s*</button>", "> <Hand size={18} /> </button>", content)
content = re.sub(r">\s*[\w]+<\s*</button>", "> <Hand size={18} /> </button>", content) # another fallback

# React button icon
content = re.sub(r"title=\"React\">\s*dY~S\s*</button>", "title=\"React\"> <Smile size={18} /> </button>", content)

# The reactions mapping
content = re.sub(r"\{\[.*?\]\.map\(emoji", "{['👍', '❤️', '😂', '🔥', '🎉'].map(emoji", content)

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
