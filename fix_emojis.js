const fs = require('fs');

let vc = fs.readFileSync('frontend/src/components/VideoChat.jsx', 'utf8');

if (!vc.includes('lucide-react')) {
  vc = vc.replace(/import \{ getSessionUser \} from '\.\.\/api'/g, "import { getSessionUser } from '../api'\nimport { Mic, MicOff, Video, VideoOff, Hand, Smile } from 'lucide-react'");
}

// 1. Mute button
vc = vc.replace(/\{isMuted \? '[^']*' : '[^']*'\}/g, "{isMuted ? <MicOff size={18} /> : <Mic size={18} />}");
// 2. Video button
vc = vc.replace(/\{isVideoOff \? '[^']*' : '[^']*'\}/g, "{isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}");
// 3. Hand button
vc = vc.replace(/>\s*[^<]*o<\s*<\/button>/g, ">\n            <Hand size={18} />\n          </button>");
// 4. React button
vc = vc.replace(/title="React">\s*[^<]*\s*<\/button>/g, 'title="React">\n              <Smile size={18} />\n            </button>');
// 5. Reaction array
vc = vc.replace(/\{\['[^\]]*\]\.map\(emoji/g, "{['👍', '❤️', '😂', '🔥', '🎉'].map(emoji");

fs.writeFileSync('frontend/src/components/VideoChat.jsx', vc, 'utf8');

let msg = fs.readFileSync('frontend/src/pages/messages.jsx', 'utf8');

// The REACTION_EMOJIS array
msg = msg.replace(/const REACTION_EMOJIS = \[[^\]]*\]/g, "const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉']");
// Fix the Mojibake comment
msg = msg.replace(/\/\/ A[^\n]*Reactions display[^\n]*/g, "// ── Reactions display ──");

fs.writeFileSync('frontend/src/pages/messages.jsx', msg, 'utf8');

console.log("Done");
