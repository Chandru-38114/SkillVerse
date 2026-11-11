import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api'

/**
 * Group video / audio call for a Learning Room (mesh: one connection per pair,
 * fine for up to about 8 people). Signalling goes over the room socket:
 *   host sends call_start {mode} -> everyone sees "Join call"
 *   a joiner sends call_join -> server replies call_peers [ids already in the call]
 *   the joiner sends an offer to each of them (so two people never call each other at once),
 *   offers / answers / candidates carry `to`, and the server adds `from`.
 */
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]

function Tile({ stream, label, isHost, muted, mode, isMe }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null
  }, [stream])
  const showVideo = mode === 'video' && stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
  return (
    <div className={`sv-rm-tile${isHost ? ' host' : ''}`}>
      <video ref={ref} autoPlay playsInline muted={muted} style={{ display: showVideo ? 'block' : 'none' }} />
      {!showVideo && <div className="sv-rm-tile-avatar" aria-hidden="true">{(label || '?').charAt(0).toUpperCase()}</div>}
      <span className="sv-rm-tile-name">
        {isHost && <span title="Host" aria-label="Host">👑 </span>}{label}{isMe ? ' (you)' : ''}
      </span>
    </div>
  )
}

export default function GroupCall({ ws, me, hostId, names, call }) {
  const [joined, setJoined] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remote, setRemote] = useState({})          // userId -> MediaStream
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [error, setError] = useState('')
  const pcs = useRef({})                              // userId -> RTCPeerConnection
  const pending = useRef({})                          // userId -> ICE candidates waiting for the remote description
  const iceRef = useRef(null)
  const localRef = useRef(null)
  const joinedRef = useRef(false)
  const isHost = me === hostId
  const mode = call?.mode || 'video'

  const send = useCallback((msg) => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [ws])

  const dropPeer = useCallback((uid) => {
    const pc = pcs.current[uid]
    if (pc) { try { pc.close() } catch { /* already closed */ } }
    delete pcs.current[uid]
    delete pending.current[uid]
    setRemote(r => { const n = { ...r }; delete n[uid]; return n })
  }, [])

  const stopAll = useCallback(() => {
    Object.keys(pcs.current).forEach(uid => dropPeer(Number(uid)))
    localRef.current?.getTracks().forEach(t => t.stop())
    localRef.current = null
    setLocalStream(null)
    joinedRef.current = false
    setJoined(false)
  }, [dropPeer])

  const makePc = useCallback((uid) => {
    if (pcs.current[uid]) return pcs.current[uid]
    const pc = new RTCPeerConnection({ iceServers: iceRef.current || STUN })
    const local = localRef.current
    if (local && local.getTracks().length) {
      local.getTracks().forEach(t => pc.addTrack(t, local))
    } else {
      // No camera/mic (denied): still receive the others.
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.addTransceiver('video', { direction: 'recvonly' })
    }
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'candidate', to: uid, candidate: e.candidate }) }
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      setRemote(r => ({ ...r, [uid]: stream }))
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') dropPeer(uid)
    }
    pcs.current[uid] = pc
    return pc
  }, [send, dropPeer])

  const flush = async (uid) => {
    const pc = pcs.current[uid]
    for (const c of pending.current[uid] || []) {
      try { await pc.addIceCandidate(c) } catch { /* stale candidate */ }
    }
    pending.current[uid] = []
  }

  // Signalling messages from the room socket.
  useEffect(() => {
    if (!ws) return
    const onMessage = async (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (msg.type === 'call_ended') { stopAll(); return }
      if (msg.type === 'removed') { stopAll(); return }
      if (!joinedRef.current) return
      try {
        if (msg.type === 'call_peers') {
          for (const uid of msg.peers) {
            const pc = makePc(uid)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            send({ type: 'offer', to: uid, sdp: pc.localDescription })
          }
        } else if (msg.type === 'offer') {
          if (pcs.current[msg.from]) dropPeer(msg.from)   // they re-joined: start clean
          const pc = makePc(msg.from)
          await pc.setRemoteDescription(msg.sdp)
          await flush(msg.from)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          send({ type: 'answer', to: msg.from, sdp: pc.localDescription })
        } else if (msg.type === 'answer') {
          const pc = pcs.current[msg.from]
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(msg.sdp)
            await flush(msg.from)
          }
        } else if (msg.type === 'candidate') {
          const pc = pcs.current[msg.from]
          if (pc && pc.remoteDescription) await pc.addIceCandidate(msg.candidate).catch(() => {})
          else (pending.current[msg.from] = pending.current[msg.from] || []).push(msg.candidate)
        } else if (msg.type === 'call_left' || msg.type === 'peer_left') {
          dropPeer(msg.user_id)
        }
      } catch (err) {
        console.warn('[GroupCall] signalling error', err)
      }
    }
    ws.addEventListener('message', onMessage)
    return () => ws.removeEventListener('message', onMessage)
    // flush only touches refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, makePc, send, dropPeer, stopAll])

  // Leave the call when the page closes or the socket changes.
  useEffect(() => () => stopAll(), [ws, stopAll])

  async function join() {
    setError('')
    if (!iceRef.current) {
      try {
        const res = await api.getTurnCredentials()
        iceRef.current = [...STUN, ...((res && res.iceServers) || [])]
      } catch { iceRef.current = STUN }
    }
    let stream = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' })
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {
        setError('No camera or microphone access. You can still watch and listen.')
      }
    }
    localRef.current = stream
    setLocalStream(stream)
    setMicOn(true)
    setCamOn(mode === 'video')
    joinedRef.current = true
    setJoined(true)
    send({ type: 'call_join' })
  }

  // The host who just started the call joins it straight away.
  const startedByMe = call && call.by === me
  useEffect(() => {
    if (startedByMe && !joinedRef.current) join()
    // join() is recreated every render; run only when a call I started appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedByMe])

  function leave() {
    send({ type: 'call_leave' })
    stopAll()
  }

  function toggle(kind) {
    const tracks = kind === 'audio' ? localRef.current?.getAudioTracks() : localRef.current?.getVideoTracks()
    if (!tracks || !tracks.length) return
    const on = !tracks[0].enabled
    tracks.forEach(t => { t.enabled = on })
    if (kind === 'audio') setMicOn(on); else setCamOn(on)
  }

  if (!call) {
    return (
      <div className="sv-rm-callbar">
        <span className="muted">No call running.</span>
        {isHost ? (
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sv-rm-btn p" onClick={() => send({ type: 'call_start', mode: 'video' })}>🎥 Start video call</button>
            <button type="button" className="sv-rm-btn" onClick={() => send({ type: 'call_start', mode: 'audio' })}>🎙️ Start audio call</button>
          </span>
        ) : <span className="muted">The host can start a video or audio call.</span>}
      </div>
    )
  }

  const people = Object.keys(remote).map(Number)
  return (
    <div className="sv-rm-call">
      <div className="sv-rm-callbar">
        <strong>{mode === 'video' ? '🎥 Video call' : '🎙️ Audio call'} in progress</strong>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!joined && <button type="button" className="sv-rm-btn p" onClick={join}>Join call</button>}
          {joined && <button type="button" className="sv-rm-btn" aria-pressed={!micOn} onClick={() => toggle('audio')}>{micOn ? '🎙️ Mute' : '🔇 Unmute'}</button>}
          {joined && mode === 'video' && <button type="button" className="sv-rm-btn" aria-pressed={!camOn} onClick={() => toggle('video')}>{camOn ? '📷 Camera off' : '📷 Camera on'}</button>}
          {joined && <button type="button" className="sv-rm-btn" onClick={leave}>Leave call</button>}
          {isHost && <button type="button" className="sv-rm-btn d" onClick={() => send({ type: 'call_end' })}>End for everyone</button>}
        </span>
      </div>
      {error && <p className="sv-rm-error" role="alert">{error}</p>}
      {joined && (
        <div className="sv-rm-grid">
          <Tile stream={localStream} label={names[me] || 'You'} isHost={isHost} muted mode={camOn ? mode : 'audio'} isMe />
          {people
            .sort((a, b) => (b === hostId) - (a === hostId))
            .map(uid => <Tile key={uid} stream={remote[uid]} label={names[uid] || 'Member'} isHost={uid === hostId} mode={mode} />)}
        </div>
      )}
      {joined && people.length === 0 && <p className="muted" style={{ margin: '8px 0 0' }}>Waiting for others to join the call…</p>}
    </div>
  )
}
