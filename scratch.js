const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/VideoChat.jsx', 'utf8');

// 1. Add state hooks
content = content.replace("const [errorMsg, setErrorMsg] = useState('')", "const [errorMsg, setErrorMsg] = useState('')\n  const [handRaised, setHandRaised] = useState(false)\n  const [peerHandRaised, setPeerHandRaised] = useState(false)\n  const [activeEmojis, setActiveEmojis] = useState([])");

// 2. Add reaction handlers
content = content.replace("function toggleMute() {", `const sendReaction = (emoji) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', reaction: 'emoji', emoji }))
    }
    const id = Date.now()
    setActiveEmojis(prev => [...prev, { id, emoji, isLocal: true }])
    setTimeout(() => {
      setActiveEmojis(prev => prev.filter(e => e.id !== id))
    }, 3000)
  }

  const toggleHand = () => {
    const nextState = !handRaised
    setHandRaised(nextState)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', reaction: 'raise_hand', active: nextState }))
    }
  }

  function toggleMute() {`);

// 3. Add to ws.onmessage
content = content.replace("} else if (data.type === 'peer_left') {", `} else if (data.type === 'reaction') {
              if (data.reaction === 'raise_hand') {
                setPeerHandRaised(data.active)
              } else if (data.reaction === 'emoji') {
                const id = Date.now()
                setActiveEmojis(prev => [...prev, { id, emoji: data.emoji, isLocal: false }])
                setTimeout(() => {
                  setActiveEmojis(prev => prev.filter(e => e.id !== id))
                }, 3000)
              }
            } else if (data.type === 'peer_left') {`);

// 4. Add peerHandRaised to UI
content = content.replace("{status === 'disconnected' && (", `{peerHandRaised && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 md:top-2 md:left-auto md:right-2 z-30 bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-bold animate-bounce shadow-lg shadow-brand/20 flex items-center gap-2">
              ✋ Hand Raised
            </div>
          )}
          {activeEmojis.map(e => (
            <div 
              key={e.id} 
              className={\`absolute z-40 text-4xl animate-float-up pointer-events-none \${e.isLocal ? 'right-4 bottom-4' : 'left-1/2 bottom-0 -translate-x-1/2'}\`}
            >
              {e.emoji}
            </div>
          ))}
          {status === 'disconnected' && (`);

// 5. Add controls Content mobile
content = content.replace(/\{isVideoOff \? 'dYs.*' : 'dY".*?'\}\s*<\/button>/g, `{isVideoOff ? '📸' : '📹'}\n      </button>`);

// Now manually inject the hand and emoji into the mobile controls (the first occurrence of controlsContent)
content = content.replace(/<button\s*onClick=\{\(\) => \(onLeave \? onLeave\(\) : navigate\('\/sessions'\)\)\}/, `<div className="w-px h-6 bg-white/20 mx-1 md:hidden"></div>
      <button
        onClick={toggleHand}
        className={\`md:hidden w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs \${handRaised ? 'bg-brand text-white shadow' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}\`}
        title="Raise Hand"
      >
        ✋
      </button>
      <button
        onClick={() => (onLeave ? onLeave() : navigate('/sessions'))}`);

// 6. Desktop controls
content = content.replace(/<div className="flex-1 flex justify-end">/, `<div className="w-px h-8 bg-line mx-2"></div>
          
          <button
            onClick={toggleHand}
            className={\`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base \${handRaised ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-ink/5 text-ink hover:bg-ink/10'}\`}
            title="Raise Hand"
          >
            ✋
          </button>
          
          <div className="relative group">
            <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all text-base bg-ink/5 text-ink hover:bg-ink/10" title="React">
              😊
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex bg-surface border border-line rounded-full shadow-xl p-1 gap-1 flex-col">
              {['👍', '❤️', '😂', '🎉', '🔥'].map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)} className="w-8 h-8 rounded-full hover:bg-ink/5 flex items-center justify-center text-lg transition-transform hover:scale-125">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex justify-end">`);

fs.writeFileSync('frontend/src/components/VideoChat.jsx', content);
