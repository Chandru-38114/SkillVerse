import os

content = """
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api'

export default function VideoChat({ sessionId, children }) {
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
          ws.send(JSON.stringify({ type: 'hello' }))
        }

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data)

          if (data.type === 'peer_joined' || data.type === 'hello') {
            setStatus('connecting')
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
    <div className="flex-1 flex flex-col h-full bg-[#FDFDFC]">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Video */}
        <div className="w-[300px] shrink-0 bg-ink flex flex-col relative border-r border-ink/20">
          
          {/* Status banner */}
          {status === 'waiting' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-ink/80 text-white px-4 py-1.5 rounded-full text-xs font-medium tracking-wide whitespace-nowrap">
              Waiting for peer...
            </div>
          )}
          {status === 'connecting' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-ink/80 text-white px-4 py-1.5 rounded-full text-xs font-medium tracking-wide">
              Connecting...
            </div>
          )}
          {status === 'disconnected' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600/90 text-white px-4 py-1.5 rounded-full text-xs font-medium tracking-wide">
              Peer left.
            </div>
          )}

          {/* Remote Video (full screen inside column) */}
          <div className="flex-1 relative">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-ink/40">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <span className="text-2xl">👤</span>
                </div>
                <p className="font-medium text-white/50 text-sm">
                  {status === 'waiting' ? 'Waiting...' : 'Connecting...'}
                </p>
              </div>
            )}
          </div>

          {/* Local Video (PiP) */}
          <div className="absolute bottom-4 right-4 w-28 aspect-video bg-black rounded-lg overflow-hidden border border-white/20 shadow-lg z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoOff ? "opacity-0" : "opacity-100"}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink">
                <span className="text-white/40 text-xs">📹 Off</span>
              </div>
            )}
          </div>
        </div>

        {/* Center & Right: Passed via children (Workspace & Info) */}
        <div className="flex-1 flex overflow-hidden">
          {children}
        </div>
      </div>

      {/* Bottom Bar: Full width */}
      <div className="h-16 shrink-0 bg-white border-t border-line flex items-center justify-between px-6 z-30">
        
        {/* left: blank or status */}
        <div className="flex-1 text-xs text-ink/50 font-medium">
          {status === 'connected' ? '🟢 Connected securely' : ''}
        </div>

        {/* center: media controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? '🚫' : '📹'}
          </button>
          
          <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-ink/5 text-ink hover:bg-ink/10 opacity-50 cursor-not-allowed" title="Share Screen">
            💻
          </button>
        </div>

        {/* right: Leave button */}
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => navigate('/sessions')}
            className="px-5 py-2 rounded-lg font-semibold transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm text-sm flex items-center gap-2"
            title="Leave Session"
          >
            Leave Session
          </button>
        </div>
      </div>
    </div>
  )
}
"""

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(content.strip())
