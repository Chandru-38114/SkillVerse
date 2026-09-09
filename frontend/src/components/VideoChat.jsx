import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api'

export default function VideoChat({ sessionId }) {
  const navigate = useNavigate()
  const [stream, setStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [status, setStatus] = useState('waiting') // waiting, connecting, connected, disconnected
  const [errorMsg, setErrorMsg] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const wsRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let ws
    let pc

    async function init() {
      try {
        // 1. Get User Media
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        setStream(mediaStream)
        streamRef.current = mediaStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream
        }

        // 2. Init Peer Connection
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        pcRef.current = pc

        // Add local tracks to PC
        mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream))

        // Listen for remote tracks
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0])
          }
        }

        // Listen for ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }))
          }
        }

        // Listen for connection state changes
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setStatus('connected')
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setStatus('disconnected')
          }
        }

        // 3. Connect WebSocket Signaling
        const token = getToken()
        const baseHttp = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const wsUrl = baseHttp.replace(/^http/, 'ws') + `/sessions/ws/${sessionId}?token=${token}`
        
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          // Send a manual ping or just wait. Backend sends 'peer_joined' to other user.
          // To handle if the other peer is ALREADY there, we might need a signal to ask "who is here".
          // The backend currently only sends "peer_joined" on join.
          // Let's have the newly joined user send a "ping" or "hello", and the other user can offer.
          ws.send(JSON.stringify({ type: 'hello' }))
        }

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)

          if (data.type === 'peer_joined' || data.type === 'hello') {
            setStatus('connecting')
            // The one who receives 'hello' or 'peer_joined' initiates the offer
            // We use 'peer_joined' from backend, or 'hello' from frontend.
            // Let's create an offer
            if (data.type === 'peer_joined') {
               const offer = await pc.createOffer()
               await pc.setLocalDescription(offer)
               ws.send(JSON.stringify({ type: 'offer', offer }))
            }
          } else if (data.type === 'offer') {
            setStatus('connecting')
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            ws.send(JSON.stringify({ type: 'answer', answer }))
          } else if (data.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          } else if (data.type === 'candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } else if (data.type === 'peer_left') {
            setStatus('disconnected')
            setRemoteStream(null)
          }
        }

        ws.onerror = () => {
          setErrorMsg('Signaling server connection error.')
        }

      } catch (err) {
        console.error(err)
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg('Camera or microphone permission denied. Please allow access.')
        } else if (err.name === 'NotFoundError') {
          setErrorMsg('No camera or microphone found.')
        } else {
          setErrorMsg(err.message || 'Failed to initialize video.')
        }
      }
    }

    init()

    return () => {
      if (ws) ws.close()
      if (pc) pc.close()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  function toggleMute() {
    if (!stream) return
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMuted(!audioTrack.enabled)
    }
  }

  function toggleVideo() {
    if (!stream) return
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoOff(!videoTrack.enabled)
    }
  }

  if (errorMsg) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ink/5 rounded-xl border border-line m-4">
        <div className="text-center p-6">
          <p className="text-4xl mb-3">🎥</p>
          <p className="text-ink/60 text-sm max-w-sm mx-auto">{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col m-4 gap-4 relative">
      {/* Status banner */}
      {status === 'waiting' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-ink/80 text-white px-4 py-1.5 rounded-full text-xs font-medium tracking-wide">
          Waiting for your peer to join...
        </div>
      )}
      {status === 'connecting' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-ink/80 text-white px-4 py-1.5 rounded-full text-xs font-medium tracking-wide">
          Connecting...
        </div>
      )}
      {status === 'disconnected' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600/90 text-white px-4 py-1.5 rounded-full text-xs font-medium tracking-wide">
          Your peer has left the session.
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 bg-ink rounded-2xl overflow-hidden relative shadow-inner border border-ink/20">
        {/* Remote Video (full screen) */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-ink/40">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <span className="text-4xl">👤</span>
            </div>
            <p className="font-medium text-white/50">
              {status === 'waiting' ? 'Waiting for peer...' : 'Connecting...'}
            </p>
          </div>
        )}

        {/* Local Video (PiP) */}
        <div className="absolute bottom-6 right-6 w-48 aspect-video bg-ink rounded-xl border-2 border-white/10 overflow-hidden shadow-xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink">
              <span className="text-white/40 text-sm">📷 Off</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="shrink-0 flex items-center justify-center gap-4 py-2">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'
          }`}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isVideoOff ? '🚫' : '📷'}
        </button>

        <button
          onClick={() => navigate('/sessions')}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-red-600 text-white hover:bg-red-700 shadow-md ml-4"
          title="Leave Call"
        >
          📞
        </button>
      </div>
    </div>
  )
}
