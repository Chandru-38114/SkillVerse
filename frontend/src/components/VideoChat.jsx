import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { REACTION_EMOJIS, getEmojiForKey } from '../utils/emojis'
import { getSessionUser } from '../api'
import { Mic, MicOff, Video, VideoOff, Hand, Smile , User } from 'lucide-react'

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
  const [handRaised, setHandRaised] = useState(false)
  const [peerHandRaised, setPeerHandRaised] = useState(false)
  const [activeEmojis, setActiveEmojis] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const wsRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    console.log('[WebRTC-Diag] VideoChat mounted')
    return () => console.log('[WebRTC-Diag] VideoChat unmounted')
  }, [])

  useEffect(() => {
    let ignore = false
    let ws = null
    let pc = null

    async function init() {
      try {
        console.log('[WebRTC-Diag] mediaDevices available:', !!navigator.mediaDevices)
        let localStream = null;
        try {
          console.log('[WebRTC-Diag] requesting camera/microphone')
          localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          if (ignore) {
            localStream.getTracks().forEach((track) => track.stop())
            return
          }
          console.log('[WebRTC-Diag] local stream obtained')
          setStream(localStream)
          streamRef.current = localStream

          const audioTrack = localStream.getAudioTracks()[0]
          const videoTrack = localStream.getVideoTracks()[0]
          if (audioTrack) setIsMuted(!audioTrack.enabled)
          if (videoTrack) setIsVideoOff(!videoTrack.enabled)

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream
          }
        } catch (err) {
          console.warn('[WebRTC-Diag] Media access denied or not found, continuing in spectator mode:', err.message)
          // We intentionally do not set errorMsg to allow signaling and viewing remote streams
        }

        console.log('[WebRTC] Creating RTCPeerConnection...')
        pc = new RTCPeerConnection(iceServers)
        pcRef.current = pc

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC-Diag] ICE state:', pc.iceConnectionState)
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            setStatus('disconnected')
          }
        }
        pc.onconnectionstatechange = () => {
          console.log('[WebRTC-Diag] Connection State:', pc.connectionState)
        }
        pc.onsignalingstatechange = () => {
          console.log('[WebRTC-Diag] Signaling State:', pc.signalingState)
        }
        pc.onicegatheringstatechange = () => {
          console.log('[WebRTC-Diag] ICE Gathering State:', pc.iceGatheringState)
        }

        if (localStream) {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
        }

        pc.ontrack = (event) => {
          console.log('[WebRTC-Diag] remote track received', event.track.kind, 'readyState:', event.track.readyState)
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
            console.log('[WebRTC] Sending ICE candidate')
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }))
          }
        }

        console.log('[WebRTC] Connecting to signaling server...')
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[WebRTC-Diag] signaling WebSocket connected')
          ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
        }

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)
          console.log('[WebRTC] Signaling message received:', data.type)

          try {
            if (data.type === 'peer_joined') {
              console.log('[WebRTC-Diag] peer joined')
              setStatus('connecting')
              ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
            } else if (data.type === 'hello') {
              setStatus('connecting')
              const remoteUserId = data.userId || data.user_id
              
              if (remoteUserId && Number(currentUser?.id) > Number(remoteUserId)) {
                if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
                  console.log('[WebRTC-Diag] offer/answer state: Creating offer')
                  const offer = await pc.createOffer()
                  await pc.setLocalDescription(offer)
                  ws.send(JSON.stringify({ type: 'offer', offer }))
                }
              }
            } else if (data.type === 'offer') {
              if (pc.signalingState !== 'stable') return
              setStatus('connecting')
              console.log('[WebRTC-Diag] offer/answer state: Received offer, setting remote description')
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
              
              for (const c of pendingCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(c))
                } catch (e) {
                  console.warn('[WebRTC] Failed to add pending ICE candidate', e)
                }
              }
              pendingCandidates = []

              console.log('[WebRTC-Diag] offer/answer state: Creating answer')
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              ws.send(JSON.stringify({ type: 'answer', answer }))
            } else if (data.type === 'answer') {
              console.log('[WebRTC-Diag] offer/answer state: Received answer, setting remote description')
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
              for (const c of pendingCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(c))
                } catch (e) {
                  console.warn('[WebRTC] Failed to add pending ICE candidate', e)
                }
              }
              pendingCandidates = []
            } else if (data.type === 'candidate') {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                console.log('[WebRTC] Adding ICE candidate')
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
                } catch (e) {
                  console.warn('[WebRTC] Failed to add ICE candidate', e)
                }
              } else {
                console.log('[WebRTC] Queuing ICE candidate (no remote desc yet)')
                pendingCandidates.push(data.candidate)
              }
            } else if (data.type === 'reaction') {
              if (data.reaction === 'raise_hand') {
                setPeerHandRaised(data.active)
              } else if (data.reaction === 'emoji') {
                const id = Date.now()
                setActiveEmojis(prev => [...prev, { id, emoji: data.emoji, isLocal: false }])
                setTimeout(() => {
                  setActiveEmojis(prev => prev.filter(e => e.id !== id))
                }, 3000)
              }
            } else if (data.type === 'peer_left') {
              console.log('[WebRTC] Peer left')
              setStatus('disconnected')
              setRemoteStream(null)
            }
          } catch (err) {
            console.error('[WebRTC] Signaling processing error:', err)
          }
        }

        ws.onerror = () => {
          console.error('[WebRTC] Signaling server connection error')
          setErrorMsg('Signaling server connection error.')
        }

      } catch (err) {
        console.error('[WebRTC-Diag] Initial WebRTC setup failed:', err)
        setErrorMsg(err.message || 'Failed to initialize session.')
      }
    }

    init()

    return () => {
      console.log('[WebRTC] Cleanup called')
      ignore = true
      if (ws) ws.close()
      if (pc) pc.close()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [sessionId])


  useEffect(() => {
    if (localVideoRef.current && stream) {
      console.log('[WebRTC-Diag] local video element stream assigned')
      localVideoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[WebRTC-Diag] remote stream assigned')
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const sendReaction = (emoji) => {
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
            <div className="w-px h-6 bg-white/20 mx-1 md:hidden"></div>
      <button
        onClick={toggleHand}
        className={`md:hidden w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs ${handRaised ? 'bg-brand text-white shadow' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}
        title="Raise Hand"
      >
        <Hand size={16} />
      </button>
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
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      <button
        onClick={toggleVideo}
        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-xs md:text-base ${isVideoOff ? 'bg-red-500 text-white shadow' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}
        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
      >
        {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
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
          {peerHandRaised && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 md:top-2 md:left-auto md:right-2 z-30 bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-bold animate-bounce shadow-lg shadow-brand/20 flex items-center gap-2">
              <Hand size={18} /> Hand Raised
            </div>
          )}
          {activeEmojis.map(e => (
            <div 
              key={e.id} 
              className={`absolute z-40 text-4xl animate-float-up pointer-events-none ${e.isLocal ? 'right-4 bottom-4' : 'left-1/2 bottom-0 -translate-x-1/2'}`}
            >
              {getEmojiForKey(e.emoji)}
            </div>
          ))}
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
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <span className="text-white/20 text-2xl mb-1"><User size={32} /></span>
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
      <div className="hidden md:flex h-14 shrink-0 bg-surface border-t border-line shadow-elev-1 items-center justify-between px-3 sm:px-5 z-30 gap-3">
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
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>
          <div className="w-px h-8 bg-line mx-2"></div>
          
          <button
            onClick={toggleHand}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${handRaised ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title="Raise Hand"
          >
            <Hand size={18} />
          </button>
          
          <div className="relative group">
            <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all text-base bg-ink/5 text-ink hover:bg-ink/10" title="React">
              <Smile size={18} />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex bg-surface border border-line rounded-full shadow-xl p-1 gap-1 flex-col">
              {REACTION_EMOJIS.map(em => (
                <button key={em.key} onClick={() => sendReaction(em.key)} className="w-8 h-8 rounded-full hover:bg-ink/5 flex items-center justify-center text-lg transition-transform hover:scale-125">
                  {em.emoji}
                </button>
              ))}
            </div>
          </div>
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

