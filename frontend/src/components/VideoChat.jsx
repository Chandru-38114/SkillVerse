import React, { useEffect, useRef, useState, createContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { REACTION_EMOJIS, getEmojiForKey } from '../utils/emojis'
import { api, getSessionUser } from '../api'
import { Mic, MicOff, Video, VideoOff, Hand, Smile , User } from 'lucide-react'


export const SessionWebSocketContext = createContext(null)

export default function VideoChat({ sessionId, children, onLeave, chatComponent }) {
  const navigate = useNavigate()
  const [stream, setStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [status, setStatus] = useState('waiting') // waiting, connecting, connected, disconnected
  const [sharedWs, setSharedWs] = useState(null)
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
  const remoteUserIdRef = useRef(null)
  const iceRestartInProgressRef = useRef(false)
  const isComponentMounted = useRef(true)

  useEffect(() => {
    console.log('[WebRTC-Diag] VideoChat mounted')
    isComponentMounted.current = true
    return () => {
      console.log('[WebRTC-Diag] VideoChat unmounted')
      isComponentMounted.current = false
    }
  }, [])

  useEffect(() => {
    let ignore = false
    let ws = null
    let pc = null
    let pingInterval = null
    const currentUser = getSessionUser()

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
        }

        console.log('[WebRTC] Fetching TURN credentials from backend...')
        let iceConfig = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        }
        try {
          console.log('[WebRTC] Request started: GET /sessions/turn-credentials')
          const resp = await api.getTurnCredentials()
          if (resp && resp.iceServers && resp.iceServers.length > 0) {
            iceConfig.iceServers = [...iceConfig.iceServers, ...resp.iceServers]
            console.log(`[WebRTC] Request succeeded - Status: 200, Added ${resp.iceServers.length} dynamic TURN credentials`)
          } else {
            console.log('[WebRTC] Request succeeded - Status: 200, but 0 TURN credentials returned.')
          }
        } catch (e) {
          console.warn(`[WebRTC-Diag] Request failed - Status: Error, Message: ${e.message}. Falling back to STUN-only.`)
        }

        if (ignore) return

        console.log('[WebRTC] Creating RTCPeerConnection...')
        pc = new RTCPeerConnection(iceConfig)
        pcRef.current = pc

        pc.oniceconnectionstatechange = async () => {
          console.log('[WebRTC-Diag] ICE state:', pc.iceConnectionState)
          if (pc.iceConnectionState === 'disconnected') {
            console.log('[WebRTC-Diag] ICE connection disconnected, waiting for reconnect...')
          } else if (pc.iceConnectionState === 'failed') {
            console.log('[WebRTC-Diag] ICE connection failed. Evaluating restart...')
            
            const remoteUserId = remoteUserIdRef.current

            if (!isComponentMounted.current || ignore || pc !== pcRef.current) return
            
            // Do not restart if session is functionally over
            setStatus(s => {
               if (s === 'ended' || s === 'disconnected') return s
               if (ws && ws.readyState !== WebSocket.OPEN) return s
               
               if (remoteUserId && Number(currentUser?.id) > Number(remoteUserId)) {
                 if (iceRestartInProgressRef.current) {
                   console.log('[WebRTC-Diag] ICE restart already in progress, ignoring.')
                   return s
                 }
                 
                 console.log('[WebRTC-Diag] Designated caller initiating ICE restart...')
                 iceRestartInProgressRef.current = true
                 
                 pc.createOffer({ iceRestart: true })
                   .then(offer => {
                     return pc.setLocalDescription(offer).then(() => offer)
                   })
                   .then(offer => {
                     if (ws && ws.readyState === WebSocket.OPEN && !ignore) {
                       ws.send(JSON.stringify({ type: 'offer', offer }))
                     }
                   })
                   .catch(e => {
                     console.error('[WebRTC-Diag] ICE restart failed:', e)
                     iceRestartInProgressRef.current = false
                   })
               }
               return s
            })
          } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            if (iceRestartInProgressRef.current) {
              console.log('[WebRTC-Diag] ICE connection restored. Resetting restart guard.')
              iceRestartInProgressRef.current = false
            }
          }
        }

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC-Diag] Connection State:', pc.connectionState)
          if (pc.connectionState === 'connected') {
            pc.getStats(null).then(stats => {
              stats.forEach(report => {
                if (report.type === 'transport' && report.state === 'connected') {
                  const localCandidate = stats.get(report.localCertificateId || report.localCandidateId);
                  const remoteCandidate = stats.get(report.remoteCertificateId || report.remoteCandidateId);
                  console.log('[WebRTC-Diag] Selected Pair:', 
                    localCandidate?.candidateType, '-to-', remoteCandidate?.candidateType);
                }
              });
            });
            setStatus('connected')
          }
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
            setRemoteStream(new MediaStream(event.streams[0].getTracks()))
            setStatus('connected')
          }
        }

        const token = localStorage.getItem('skillverse_token')
        const wsUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000')
          .replace('http', 'ws') + `/sessions/ws/${sessionId}?token=${token}`

        let pendingCandidates = []

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`[WebRTC-Diag] Generated ICE candidate: ${event.candidate.type} (${event.candidate.protocol})`)
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }))
            }
          }
        }

        console.log('[WebRTC] Connecting to signaling server...')
        ws = new WebSocket(wsUrl)
        wsRef.current = ws
        setSharedWs(ws)

        ws.addEventListener('open', () => {
          console.log('[WebRTC-Diag] signaling WebSocket connected')
          ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
          
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, 30000)
        })

        // Sequential message queue implementation
        let isProcessingQueue = false
        const messageQueue = []

        const processQueue = async () => {
          if (isProcessingQueue) return
          isProcessingQueue = true

          while (messageQueue.length > 0) {
            const event = messageQueue.shift()
            if (ignore || pc !== pcRef.current) continue
            
            try {
              const data = JSON.parse(event.data)
              if (data.type !== 'candidate' && data.type !== 'reaction') {
                console.log('[WebRTC] Signaling message received:', data.type)
              }

              if (data.type === 'peer_joined') {
                console.log('[WebRTC-Diag] peer joined')
                setStatus(s => s === 'ended' || s === 'disconnected' ? s : 'connecting')
                ws.send(JSON.stringify({ type: 'hello', userId: currentUser?.id }))
              } else if (data.type === 'hello') {
                setStatus(s => s === 'ended' || s === 'disconnected' ? s : 'connecting')
                const remoteUserId = data.userId || data.user_id
                if (remoteUserId) {
                  remoteUserIdRef.current = remoteUserId
                }
                
                if (remoteUserId && Number(currentUser?.id) > Number(remoteUserId)) {
                  if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
                    console.log('[WebRTC-Diag] offer/answer state: Creating offer')
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    if (ws && ws.readyState === WebSocket.OPEN && !ignore) {
                      ws.send(JSON.stringify({ type: 'offer', offer }))
                    }
                  }
                }
              } else if (data.type === 'offer') {
                if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
                  console.warn('[WebRTC-Diag] Received offer in wrong signaling state:', pc.signalingState)
                }
                setStatus(s => s === 'ended' || s === 'disconnected' ? s : 'connecting')
                console.log('[WebRTC-Diag] offer/answer state: Received offer, setting remote description')
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
                } catch (e) {
                  console.error('[WebRTC-Diag] Failed to set remote description (offer):', e)
                  continue
                }
                
                const candidatesToProcess = [...pendingCandidates]
                pendingCandidates = []
                for (const c of candidatesToProcess) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(c))
                  } catch (e) {
                    console.warn('[WebRTC] Failed to add pending ICE candidate', e)
                  }
                }

                console.log('[WebRTC-Diag] offer/answer state: Creating answer')
                try {
                  const answer = await pc.createAnswer()
                  await pc.setLocalDescription(answer)
                  if (ws && ws.readyState === WebSocket.OPEN && !ignore) {
                    ws.send(JSON.stringify({ type: 'answer', answer }))
                  }
                } catch (e) {
                  console.error('[WebRTC-Diag] Failed to create answer:', e)
                }
              } else if (data.type === 'answer') {
                console.log('[WebRTC-Diag] offer/answer state: Received answer, setting remote description')
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
                  if (iceRestartInProgressRef.current) {
                    iceRestartInProgressRef.current = false
                    console.log('[WebRTC-Diag] ICE restart negotiation completed.')
                  }
                } catch (e) {
                  console.error('[WebRTC-Diag] Failed to set remote description (answer):', e)
                }
                const candidatesToProcess = [...pendingCandidates]
                pendingCandidates = []
                for (const c of candidatesToProcess) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(c))
                  } catch (e) {
                    console.warn('[WebRTC] Failed to add pending ICE candidate', e)
                  }
                }
              } else if (data.type === 'candidate') {
                if (pc.remoteDescription && pc.remoteDescription.type) {
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
              } else if (data.type === 'peer_disconnected') {
                console.log('[WebRTC] Peer disconnected (temporary network drop)')
                setStatus(s => s === 'ended' || s === 'disconnected' ? s : 'connecting')
              } else if (data.type === 'peer_left') {
                console.log('[WebRTC] Peer left permanently')
                setStatus('disconnected')
                setRemoteStream(null)
              }
            } catch (err) {
              console.error('[WebRTC] Signaling processing error:', err)
            }
          }
          isProcessingQueue = false
        }

        ws.addEventListener('message', (event) => {
          messageQueue.push(event)
          processQueue()
        })

        ws.addEventListener('close', (event) => {
          console.log(`[WebRTC-Diag] WebSocket closed with code: ${event.code}`)
          if (event.code === 1008) {
            console.log('[WebRTC] Backend terminated session (ended).')
            setStatus('ended')
            setRemoteStream(null)
            if (pcRef.current) {
               pcRef.current.close()
            }
          } else {
            console.log('[WebRTC] Signaling connection disconnected unexpectedly.')
            setStatus(s => (s === 'ended' || s === 'disconnected' ? s : 'connecting'))
          }
        })

        ws.onerror = () => {
          console.error('[WebRTC] Signaling server connection error')
          setStatus(s => {
            if (s !== 'ended' && s !== 'disconnected') {
              setErrorMsg('Signaling server connection error.')
            }
            return s
          })
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
      if (pingInterval) clearInterval(pingInterval)
      
      // Allow current status check by passing a callback
      setStatus(currentStatus => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentStatus !== 'ended') {
            wsRef.current.send(JSON.stringify({ type: 'peer_left', userId: currentUser?.id }))
            wsRef.current.close()
        } else if (wsRef.current) {
            wsRef.current.close()
        }
        return currentStatus
      })

      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
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
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 min-w-0 w-full h-full bg-paper">
      
      {/* Workspace (Left/Main) */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 w-full h-full">
        <SessionWebSocketContext.Provider value={sharedWs}>
          {children}
        </SessionWebSocketContext.Provider>
      </div>

      {/* Right Sidebar (Video + Chat) */}
      <div className="md:w-[320px] lg:w-[360px] xl:w-[400px] shrink-0 flex flex-col bg-surface border-l border-line z-20 overflow-hidden relative">
        
        {/* Video Card Area */}
        <div className="p-4 border-b border-line shrink-0 flex flex-col items-center">
          
          {/* Main Video Bubble */}
          <div className="w-full bg-[#111] rounded-2xl overflow-hidden shadow-sm relative flex flex-col border border-line aspect-[4/3]">
            
            {/* Top Bar inside Video */}
            <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xs tracking-wide">Video Call</span>
                {(status === 'connected') && <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider animate-pulse">Live</span>}
                {(status === 'waiting' || status === 'connecting') && <span className="px-1.5 py-0.5 rounded bg-gold text-white text-[9px] font-bold uppercase tracking-wider">Connecting</span>}
                {(status === 'ended') && <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider">Ended</span>}
                {(status === 'disconnected') && <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider">Offline</span>}
              </div>
            </div>

            {/* Remote Video */}
            <div className="flex-1 relative w-full h-full">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => e.target.play().catch(console.error)}
                  className="w-full h-full object-cover bg-black"
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

            {/* Local Video PiP */}
            <div className="absolute bottom-3 right-3 w-20 sm:w-24 aspect-video bg-black rounded-lg overflow-hidden shadow-lg z-20 border border-white/20">
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

            {/* Reactions */}
            {peerHandRaised && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-bold animate-bounce shadow-lg shadow-brand/20 flex items-center gap-2">
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
          </div>

          {/* Video Controls under video */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={toggleMute}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200 shadow-sm' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={toggleVideo}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all text-base ${isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200 shadow-sm' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
            <div className="w-px h-6 bg-line mx-1"></div>
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
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex bg-surface border border-line rounded-full shadow-xl p-1 gap-1 flex-col z-50">
                {REACTION_EMOJIS.map(em => (
                  <button key={em.key} onClick={() => sendReaction(em.key)} className="w-8 h-8 rounded-full hover:bg-ink/5 flex items-center justify-center text-lg transition-transform hover:scale-125">
                    {em.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Component injected from session_room */}
        <div className="flex-1 overflow-hidden relative">
          {chatComponent}
        </div>
      </div>
    </div>
  )
}

