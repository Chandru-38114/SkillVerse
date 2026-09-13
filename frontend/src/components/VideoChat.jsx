import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionUser } from '../api'

// STUN servers for WebRTC
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export default function VideoChat({ sessionId, children, onLeave }) {
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
    let ws = null
    let pc = null

    async function init() {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setStream(localStream)
        streamRef.current = localStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }

        pc = new RTCPeerConnection(iceServers)
        pcRef.current = pc

        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0])
            setStatus('connected')
          }
        }

        const currentUser = getSessionUser()
        const token = localStorage.getItem('skillverse_token')
        const wsUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000')
          .replace('http', 'ws') + `/sessions/ws/${sessionId}?token=${token}`

        let pendingCandidates = []

        pc.onicecandidate = (event) => {
          if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }))
          }
        }

        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
        }

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)

          try {
            if (data.type === 'peer_joined') {
              setStatus('connecting')
              ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
            } else if (data.type === 'hello') {
              setStatus('connecting')
              const remoteUserId = data.userId || data.user_id
              
              if (remoteUserId && currentUser?.id > remoteUserId) {
                if (pc.signalingState === 'stable') {
                  const offer = await pc.createOffer({ iceRestart: true })
                  await pc.setLocalDescription(offer)
                  ws.send(JSON.stringify({ type: 'offer', offer }))
                }
              }
            } else if (data.type === 'offer') {
              if (pc.signalingState !== 'stable') return
              setStatus('connecting')
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
              
              for (const c of pendingCandidates) {
                await pc.addIceCandidate(new RTCIceCandidate(c))
              }
              pendingCandidates = []

              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              ws.send(JSON.stringify({ type: 'answer', answer }))
            } else if (data.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
              for (const c of pendingCandidates) {
                await pc.addIceCandidate(new RTCIceCandidate(c))
              }
              pendingCandidates = []
            } else if (data.type === 'candidate') {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
              } else {
                pendingCandidates.push(data.candidate)
              }
            } else if (data.type === 'peer_left') {
              setStatus('disconnected')
              setRemoteStream(null)
            }
          } catch (err) {
            console.error('WebRTC signaling error:', err)
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
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <div className="h-32 sm:h-48 md:h-auto md:w-[240px] lg:w-[260px] xl:w-[280px] shrink-0 bg-[#1a1a2e] flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-ink/20 z-20 p-4 text-center">
            <p className="font-semibold text-white mb-1 text-sm">Media Unavailable</p>
            <p className="text-white/60 text-xs mb-4">{errorMsg}</p>
            <button
              onClick={() => (onLeave ? onLeave() : navigate('/sessions'))}
              className="px-4 py-2 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 text-xs"
            >
              Leave Session
            </button>
          </div>
          {children}
        </div>
      </div>
    )
  }

  const controlsContent = (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-xs md:text-base ${isMuted ? 'bg-red-500 text-white shadow' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎙️'}
      </button>
      <button
        onClick={toggleVideo}
        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-xs md:text-base ${isVideoOff ? 'bg-red-500 text-white shadow' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}
        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
      >
        {isVideoOff ? '🚫' : '📷'}
      </button>
      {/* Mobile Leave Button overlaid */}
      <button
        onClick={() => (onLeave ? onLeave() : navigate('/sessions'))}
        className="md:hidden ml-auto px-3 py-1.5 rounded-full font-semibold transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm text-xs whitespace-nowrap"
        title="Leave Session"
      >
        Leave
      </button>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

        {/* Video panel - mobile-optimized compact height */}
        <div className="h-28 sm:h-36 md:h-auto md:w-[240px] lg:w-[260px] xl:w-[280px] shrink-0 bg-[#111] flex flex-col relative border-b md:border-b-0 md:border-r border-ink/20 z-20">

          {(status === 'waiting' || status === 'connecting') && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white/90 px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap">
              {status === 'waiting' ? 'Waiting...' : 'Connecting...'}
            </div>
          )}
          {status === 'disconnected' && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-red-600/90 text-white px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap">
              Peer left
            </div>
          )}

          {/* Remote video */}
          <div className="flex-1 relative w-full h-full">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                onLoadedMetadata={(e) => e.target.play().catch(console.error)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <span className="text-white/20 text-2xl mb-1">👤</span>
                <p className="font-medium text-white/30 text-[10px]">
                  {status === 'waiting' ? 'Waiting' : 'Connecting'}
                </p>
              </div>
            )}
          </div>

          {/* Local video PiP */}
          <div className="absolute top-2 right-2 w-16 sm:w-20 aspect-[3/4] md:aspect-video md:bottom-16 md:top-auto bg-black rounded overflow-hidden shadow-lg z-20 border border-white/10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <span className="text-white/40 text-[10px]">Off</span>
              </div>
            )}
          </div>

          {/* Mobile overlaid controls (hidden on desktop) */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center z-30">
            {controlsContent}
          </div>
        </div>

        {/* Workspace + sidebar */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 min-w-0">
          {children}
        </div>
      </div>

      {/* Desktop Bottom control bar */}
      <div className="hidden md:flex h-14 shrink-0 bg-white border-t border-line items-center justify-between px-3 sm:px-5 z-30 gap-3">
        <div className="flex-1 text-xs text-ink/50 font-medium min-w-0 truncate">
          {status === 'connected' && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-moss" />
              Connected securely
            </span>
          )}
        </div>
        
        {/* Desktop Media Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎙️'}
          </button>
          <button
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? '🚫' : '📷'}
          </button>
        </div>

        <div className="flex-1 flex justify-end">
          <button
            onClick={() => (onLeave ? onLeave() : navigate('/sessions'))}
            className="px-5 py-2 rounded-lg font-semibold transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm text-sm whitespace-nowrap"
            title="Leave Session"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}