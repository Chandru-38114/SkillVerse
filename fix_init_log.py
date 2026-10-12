with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("console.error('[WebRTC] Initialization error:', err)", "console.error('[WebRTC-Diag] local getUserMedia or init failed:', err)")

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
