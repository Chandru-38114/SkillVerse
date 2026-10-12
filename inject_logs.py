import re

with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add mounted logging
if 'console.log(\'[WebRTC-Diag] VideoChat mounted\')' not in text:
    mount_effect = """
  useEffect(() => {
    console.log('[WebRTC-Diag] VideoChat mounted')
    return () => console.log('[WebRTC-Diag] VideoChat unmounted')
  }, [])
"""
    text = text.replace('const streamRef = useRef(null)\n', 'const streamRef = useRef(null)\n' + mount_effect)

# 2. Add local stream effect assignment
if 'console.log(\'[WebRTC-Diag] local video element stream assigned\')' not in text:
    local_stream_effect = """
  useEffect(() => {
    if (localVideoRef.current && stream) {
      console.log('[WebRTC-Diag] local video element stream assigned')
      localVideoRef.current.srcObject = stream
    }
  }, [stream])
"""
    text = text.replace('  useEffect(() => {\n    if (remoteVideoRef.current && remoteStream) {', local_stream_effect + '\n  useEffect(() => {\n    if (remoteVideoRef.current && remoteStream) {')

# 3. Add init diagnostic logs
text = text.replace('console.log(\'[WebRTC] Requesting local media...\')', "console.log('[WebRTC-Diag] mediaDevices available:', !!navigator.mediaDevices)\n        console.log('[WebRTC-Diag] requesting camera/microphone')")
text = text.replace('console.log(\'[WebRTC] Local media obtained\')', "console.log('[WebRTC-Diag] local stream obtained')\n        console.log('[WebRTC-Diag] video tracks count:', localStream.getVideoTracks().length, 'readyState:', localStream.getVideoTracks()[0]?.readyState)\n        console.log('[WebRTC-Diag] audio tracks count:', localStream.getAudioTracks().length, 'readyState:', localStream.getAudioTracks()[0]?.readyState)")

# 4. Enhance error log
text = text.replace("console.error('[WebRTC-Diag] local getUserMedia or init failed:', err)", "console.error('[WebRTC-Diag] local getUserMedia or init failed:', err.name, err.message, err)")

# 5. Fix signaling logs
text = text.replace('console.log(\'[WebRTC] Signaling server connected\')', "console.log('[WebRTC-Diag] signaling WebSocket connected')")
text = text.replace('if (data.type === \'peer_joined\') {\n              setStatus(\'connecting\')', "if (data.type === 'peer_joined') {\n              console.log('[WebRTC-Diag] peer joined')\n              setStatus('connecting')")
text = text.replace("console.log('[WebRTC] Creating offer')", "console.log('[WebRTC-Diag] offer/answer state: Creating offer')")
text = text.replace("console.log('[WebRTC] Received offer, setting remote description')", "console.log('[WebRTC-Diag] offer/answer state: Received offer, setting remote description')")
text = text.replace("console.log('[WebRTC] Creating answer')", "console.log('[WebRTC-Diag] offer/answer state: Creating answer')")
text = text.replace("console.log('[WebRTC] Received answer, setting remote description')", "console.log('[WebRTC-Diag] offer/answer state: Received answer, setting remote description')")
text = text.replace("console.log('[WebRTC] Remote track received')", "console.log('[WebRTC-Diag] remote track received', event.track.kind, 'readyState:', event.track.readyState)")
text = text.replace("console.log('[WebRTC-Diag] Remote video stream assigned to video element')", "console.log('[WebRTC-Diag] remote stream assigned')")
text = text.replace("console.log('[WebRTC-Diag] ICE Connection State:', pc.iceConnectionState)", "console.log('[WebRTC-Diag] ICE state:', pc.iceConnectionState)")

# Write back
with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
