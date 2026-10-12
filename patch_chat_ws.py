import re

with open('frontend/src/pages/chat.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the connectWs / useEffect block for requestId.
# We need to find the useEffect that depends on [requestId].
# It looks like:
"""
  useEffect(() => {
    if (!requestId) return
    setMessages(null)
    setConnectionState('connecting')

    const connectWs = () => {
      const token = localStorage.getItem('token')
      const ws = new WebSocket(`${chatSocketUrl}/${requestId}?token=${token}`)
      socketRef.current = ws

      ws.onopen = () => {
"""

pattern = re.compile(r"  useEffect\(\(\) => \{\n    if \(\!requestId\) return\n    setMessages\(null\)\n    setConnectionState\('connecting'\)\n\n    const connectWs = \(\) => \{(.*?)\n    connectWs\(\)\n    api\.markMessagesRead\(requestId\)\.catch\(console\.error\)\n  \}, \[requestId\]\)", re.DOTALL)

replacement = """  useEffect(() => {
    if (!requestId) return
    let isActive = true;
    let ws = null;
    let reconnectTimer = null;
    let currentDelay = RECONNECT_DELAY_MS;

    setMessages(null)
    setConnectionState('connecting')

    const connectWs = () => {
      if (!isActive) return;
      const url = chatSocketUrl(requestId);
      ws = new WebSocket(url);
      socketRef.current = ws

      ws.onopen = () => {
        if (!isActive) return
        setConnectionState('live')
        currentDelay = RECONNECT_DELAY_MS
        setError('')
      }

      ws.onmessage = (event) => {
        if (!isActive) return
        const data = JSON.parse(event.data)
        if (data.type === 'history') {
          setMessages(data.messages)
        } else if (data.type === 'message') {
          setMessages((prev) => (prev ? [...prev, data.message] : [data.message]))
          api.markMessagesRead(requestId).catch(console.error)
        }
      }

      ws.onclose = (event) => {
        if (!isActive) return
        socketRef.current = null
        if (event.code === 4401 || event.code === 4403) {
          setConnectionState('offline')
          setError(event.code === 4401 ? 'Session expired.' : 'No access.')
          return
        }
        
        setConnectionState('reconnecting')
        reconnectTimer = setTimeout(() => {
          currentDelay = Math.min(currentDelay * 1.5, 10000)
          connectWs()
        }, currentDelay)
      }

      ws.onerror = () => { ws.close() }
    }

    connectWs()
    api.markMessagesRead(requestId).catch(console.error)

    return () => {
      isActive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (socketRef.current === ws) socketRef.current = null
    }
  }, [requestId])"""

new_content = pattern.sub(replacement, content)
if new_content == content:
    print("WARNING: chat.jsx replace failed!")
else:
    with open('frontend/src/pages/chat.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("chat.jsx updated successfully!")
