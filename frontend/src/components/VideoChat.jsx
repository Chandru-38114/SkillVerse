import { Mic, MicOff, Video, VideoOff, ScreenShare, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, getSessionUser } from '../api'

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
        // 1. Get local media
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setStream(localStream)
        streamRef.current = localStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }

        // 2. Setup WebRTC
        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        pc = new RTCPeerConnection(config)
        pcRef.current = pc

        // Add local tracks
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

        // Listen for remote tracks
        pc.ontrack = (event) => {
          if (event.streams && event.streams.length > 0) {
            setRemoteStream(event.streams[0])
          } else {
            setRemoteStream(prev => {
              if (prev) {
                prev.addTrack(event.track)
                return prev
              }
              return new MediaStream([event.track])
            })
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
            setStatus('connecting')
          }
        }

        // 3. Connect WebSocket Signaling
        const token = getToken()
        const baseHttp = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const wsUrl = baseHttp.replace(/^http/, 'ws') + `/sessions/ws/${sessionId}?token=${token}`
        
        const currentUser = getSessionUser()
        let pendingCandidates = []

        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
        }

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)

          try {
            if (data.type === 'peer_joined' || data.type === 'hello') {
              setStatus('connecting')
              const remoteUserId = data.userId || data.user_id
              
              const shouldCreateOffer = remoteUserId 
                ? currentUser?.id > remoteUserId 
                : data.type === 'peer_joined'

              if (shouldCreateOffer && pc.signalingState === 'stable') {
                 const offer = await pc.createOffer({ iceRestart: true })
                 await pc.setLocalDescription(offer)
                 ws.send(JSON.stringify({ type: 'offer', offer }))
              }
            } else if (data.type === 'offer') {
              if (pc.signalingState !== 'stable') {
                console.warn('Glare detected, ignoring offer in non-stable state')
                return
              }
              setStatus('connecting')
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
              
              // Process queued candidates sequentially
              for (const c of pendingCandidates) {
                await pc.addIceCandidate(new RTCIceCandidate(c))
              }
              pendingCandidates = []

              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              ws.send(JSON.stringify({ type: 'answer', answer }))
            } else if (data.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
              
              // Process queued candidates sequentially
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
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-center flex-1 bg-ink/5 border-b md:border-b-0 md:border-r border-line">
          <div className="text-center p-6 max-w-sm">
            <p className="text-4xl mb-3">🎥</p>
            <p className="font-semibold text-ink mb-1 text-sm">Camera Unavailable</p>
            <p className="text-ink/60 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={() => (onLeave ? onLeave() : navigate('/sessions'))}
              className="px-4 py-2 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 text-sm"
            >
              Leave Session
            </button>
          </div>
        </div>
        {children && (
          <div className="flex-1 flex overflow-hidden min-h-0">{children}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* ── Main Content: video column + workspace ──────────── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

        {/* Video panel — top strip on mobile, left column on desktop */}
        <div className="h-40 sm:h-48 md:h-auto md:w-[240px] lg:w-[260px] xl:w-[280px] shrink-0 bg-[#1a1a2e] flex flex-col relative border-b md:border-b-0 md:border-r border-ink/20 z-20">

          {/* Status pill */}
          {(status === 'waiting' || status === 'connecting') && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 bg-ink/80 text-white px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap">
              {status === 'waiting' ? 'Waiting for peer...' : 'Connecting...'}
            </div>
          )}
          {status === 'disconnected' && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 bg-red-600/90 text-white px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide">
              Peer left
            </div>
          )}
          {status === 'connected' && (
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 bg-black/30 text-white/80 px-2 py-0.5 rounded-full text-[9px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-moss animate-pulse" />
              Live
            </div>
          )}

          {/* Remote video */}
          <div className="flex-1 relative">
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
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                  <span className="text-xl">👤</span>
                </div>
                <p className="font-medium text-white/40 text-xs">
                  {status === 'waiting' ? 'Waiting...' : 'Connecting...'}
                </p>
              </div>
            )}
          </div>

          {/* Local video PiP */}
          <div className="absolute bottom-2 right-2 w-20 sm:w-24 aspect-video bg-black rounded-md overflow-hidden border border-white/20 shadow-md z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/90">
                <span className="text-white/40 text-[10px]">Cam off</span>
              </div>
            )}
          </div>
        </div>

        {/* Workspace + sidebar (children from session room) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 min-w-0">
          {children}
        </div>
      </div>

      {/* ── Bottom control bar ─────────────────────────────── */}
      <div className="h-14 shrink-0 bg-white border-t border-line flex items-center justify-between px-3 sm:px-5 z-30 gap-3">

        {/* Left: connection status (desktop) */}
        <div className="hidden md:block flex-1 text-xs text-ink/50 font-medium min-w-0 truncate">
          {status === 'connected' && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-moss" />
              Connected securely
            </span>
          )}
        </div>

        {/* Center: media controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? '🚫' : '📹'}
          </button>
        </div>

        {/* Right: Leave button — visually separated, clearly destructive */}
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => (onLeave ? onLeave() : navigate('/sessions'))}
            className="px-4 sm:px-5 py-2 rounded-lg font-semibold transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm text-sm whitespace-nowrap"
            title="Leave Session"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}