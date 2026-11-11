import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, getSessionUser, roomSocketUrl } from '../api'
import { SessionWebSocketContext } from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import GroupCall from '../components/rooms/GroupCall'
import './rooms.css'

// Close codes after which reconnecting makes no sense.
const FINAL_CODES = { 4401: 'Please sign in again.', 4403: 'You are not a member of this room.', 4409: 'This room is open in another tab.', 4410: 'This room was closed.' }

function ShareToChat({ link, title, onClose }) {
  const [convos, setConvos] = useState(null)
  const [sent, setSent] = useState({})
  const [error, setError] = useState('')
  useEffect(() => {
    api.getChatInbox().then(setConvos).catch(() => setConvos([]))
  }, [])
  async function share(c) {
    setError('')
    try {
      await api.sendMessage(c.request_id, `Join my SkillVerse learning room "${title}": ${link}`)
      setSent(s => ({ ...s, [c.request_id]: true }))
    } catch (err) {
      setError(err.message || 'Could not send the link')
    }
  }
  return (
    <div className="sv-rm-overlay" role="dialog" aria-modal="true" aria-labelledby="sv-share-title" onClick={onClose}>
      <div className="card sv-rm-modal" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="sv-share-title">Share in chat</h2>
          <button type="button" className="sv-rm-btn sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The room link is sent as a chat message.</p>
        {convos === null && <p className="muted">Loading your chats…</p>}
        {convos && convos.length === 0 && <p className="muted">No chats yet. Copy the link instead.</p>}
        {convos && convos.map(c => (
          <div key={c.request_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span><strong>{c.other_user_name}</strong> <span className="muted" style={{ fontSize: 12 }}>· {c.skill_name}</span></span>
            <button type="button" className={`sv-rm-btn sm${sent[c.request_id] ? '' : ' p'}`} disabled={sent[c.request_id]} onClick={() => share(c)}>
              {sent[c.request_id] ? 'Sent ✓' : 'Send link'}
            </button>
          </div>
        ))}
        {error && <p className="sv-rm-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}

export default function Room() {
  const { code } = useParams()
  const navigate = useNavigate()
  const me = getSessionUser()
  const [room, setRoom] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [ws, setWs] = useState(null)
  const [online, setOnline] = useState([])
  const [call, setCall] = useState(null)              // {mode, by, members:Set}
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState('code')
  const [notice, setNotice] = useState('')
  const [ended, setEnded] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const msgsRef = useRef(null)

  const link = `${window.location.origin}/rooms/${code}`
  const isMember = room?.my_status === 'active'

  const loadRoom = useCallback(() => {
    return api.getRoom(code).then(r => { setRoom(r); setLoadError(''); return r })
      .catch(err => setLoadError(err.message || 'Room not found'))
  }, [code])

  useEffect(() => { loadRoom() }, [loadRoom])

  // Socket: one per member; reconnects unless the server says it's final.
  useEffect(() => {
    if (!isMember) return undefined
    let socket, ping, retry, stopped = false
    api.getRoomMessages(code).then(setMessages).catch(() => {})

    const connect = () => {
      socket = new WebSocket(roomSocketUrl(code))
      socket.addEventListener('open', () => {
        setWs(socket)
        ping = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: 'ping' })), 25000)
      })
      socket.addEventListener('message', (event) => {
        let m
        try { m = JSON.parse(event.data) } catch { return }
        switch (m.type) {
          case 'welcome':
            setOnline(m.online)
            setCall(m.call ? { mode: m.call.mode, by: null, members: new Set(m.call.members) } : null)
            break
          case 'peer_joined':
            setOnline(o => (o.includes(m.user.id) ? o : [...o, m.user.id]))
            loadRoom()
            break
          case 'peer_left':
            setOnline(o => o.filter(id => id !== m.user_id))
            setCall(c => (c ? { ...c, members: new Set([...c.members].filter(id => id !== m.user_id)) } : c))
            break
          case 'chat':
            setMessages(list => (list.some(x => x.id === m.id) ? list : [...list, m]))
            break
          case 'call_started':
            setCall({ mode: m.mode, by: m.by, members: new Set() })
            break
          case 'call_ended':
            setCall(null)
            break
          case 'call_peers':   // my own join was accepted
            setCall(c => (c && me ? { ...c, members: new Set([...c.members, me.id]) } : c))
            break
          case 'call_joined':
            setCall(c => (c ? { ...c, members: new Set([...c.members, m.user_id]) } : c))
            break
          case 'call_left':
            setCall(c => (c ? { ...c, members: new Set([...c.members].filter(id => id !== m.user_id)) } : c))
            break
          case 'members_changed':
          case 'room_updated':
            loadRoom()
            break
          case 'removed':
            stopped = true
            setEnded(m.reason || 'You are no longer in this room.')
            break
          default:
        }
      })
      socket.addEventListener('close', (e) => {
        clearInterval(ping)
        setWs(null)
        if (stopped) return
        if (FINAL_CODES[e.code]) { setEnded(FINAL_CODES[e.code]); return }
        retry = setTimeout(connect, 2000)
      })
    }
    connect()
    return () => {
      stopped = true
      clearInterval(ping)
      clearTimeout(retry)
      try { socket && socket.close() } catch { /* already closed */ }
    }
  }, [code, isMember, loadRoom])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages])

  const names = useMemo(() => {
    const n = {}
    for (const m of room?.members || []) n[m.id] = m.name
    if (me) n[me.id] = me.name
    return n
  }, [room, me])

  // Stores so the shared editor and board save to / run in this room.
  const codeStore = useMemo(() => ({
    load: () => api.getRoomCode(code),
    save: (text, lang) => api.saveRoomCode(code, text, lang),
    run: (text, lang, stdin) => api.runRoomCode(code, text, lang, stdin),
  }), [code])
  const boardStore = useMemo(() => ({
    load: () => api.getRoomWhiteboard(code),
    save: (state) => api.saveRoomWhiteboard(code, state),
  }), [code])

  async function act(fn, after) {
    setBusy(true); setNotice('')
    try { const r = await fn(); if (after) after(r) } catch (err) { setNotice(err.message || 'Something went wrong') }
    finally { setBusy(false) }
  }

  function sendChat(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat', text }))
    setDraft('')
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setNotice('Link copied. Paste it in any chat.') }
    catch { setNotice(link) }
  }

  if (loadError) {
    return (
      <div className="sv-rooms"><div className="wrap">
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <h1>Can't open this room</h1>
          <p className="muted">{loadError}</p>
          <Link className="sv-rm-btn p" to="/rooms">Back to Rooms</Link>
        </div>
      </div></div>
    )
  }
  if (!room) return <div className="sv-rooms"><div className="wrap"><p className="muted">Loading room…</p></div></div>

  const header = (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="eb">LEARNING ROOM{room.skill ? ` · ${room.skill.toUpperCase()}` : ''}</span>
          <h1 style={{ overflowWrap: 'anywhere' }}>{room.title}</h1>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`pill ${room.visibility === 'public' ? 'pub' : 'priv'}`}>{room.visibility === 'public' ? '🌐 Public' : '🔒 Private'}</span>
            {room.status === 'locked' && <span className="pill">⛔ Locked</span>}
            {call && <span className="pill live">● Live call</span>}
            <span className="pill">👥 {room.member_count}/{room.max_participants}</span>
            <span className="pill">👑 {room.host?.name}</span>
          </span>
          {room.description && <p className="muted" style={{ margin: 0 }}>{room.description}</p>}
        </div>
        {isMember && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sv-rm-btn" onClick={copyLink}>🔗 Copy link</button>
            <button type="button" className="sv-rm-btn" onClick={() => setShareOpen(true)}>💬 Share in chat</button>
            {room.is_host ? (
              <>
                <button type="button" className="sv-rm-btn" disabled={busy}
                  onClick={() => act(() => api.updateRoom(code, { status: room.status === 'locked' ? 'open' : 'locked' }), setRoom)}>
                  {room.status === 'locked' ? '🔓 Unlock' : '🔒 Lock'}
                </button>
                <button type="button" className="sv-rm-btn" disabled={busy}
                  onClick={() => act(() => api.updateRoom(code, { visibility: room.visibility === 'public' ? 'private' : 'public' }), setRoom)}>
                  Make {room.visibility === 'public' ? 'private' : 'public'}
                </button>
                <button type="button" className="sv-rm-btn d" disabled={busy}
                  onClick={() => { if (window.confirm('Close this room for everyone?')) act(() => api.closeRoom(code), () => navigate('/rooms')) }}>
                  Close room
                </button>
              </>
            ) : (
              <button type="button" className="sv-rm-btn" disabled={busy} onClick={() => act(() => api.leaveRoom(code), () => navigate('/rooms'))}>Leave room</button>
            )}
          </div>
        )}
      </div>
      {notice && <p className="muted" role="status" style={{ margin: 0, fontWeight: 700, overflowWrap: 'anywhere' }}>{notice}</p>}
    </div>
  )

  if (ended) {
    return (
      <div className="sv-rooms"><div className="wrap">
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <h1>{room.title}</h1>
          <p className="muted">{ended}</p>
          <Link className="sv-rm-btn p" to="/rooms">Back to Rooms</Link>
        </div>
      </div></div>
    )
  }

  if (!isMember) {
    const blocked = room.my_status === 'removed' ? 'The host removed you from this room.'
      : room.status === 'locked' ? 'The host has locked this room.'
      : room.member_count >= room.max_participants ? 'This room is full.' : ''
    return (
      <div className="sv-rooms"><div className="wrap">
        {header}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <h2>Join this room to see the chat, call, code and board</h2>
          {blocked ? <p className="sv-rm-error">{blocked}</p> : (
            <button type="button" className="sv-rm-btn p" disabled={busy} onClick={() => act(() => api.joinRoom(code), setRoom)}>Join room</button>
          )}
          {notice && <p className="sv-rm-error" role="alert">{notice}</p>}
        </div>
      </div></div>
    )
  }

  return (
    <SessionWebSocketContext.Provider value={ws}>
      <div className="sv-rooms"><div className="wrap">
        {header}
        {!ws && <p className="muted" role="status" style={{ margin: 0 }}>Connecting to the room…</p>}
        <div className="sv-rm-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <section className="card" aria-label="Call">
              <GroupCall ws={ws} me={me?.id} hostId={room.host?.id} names={names} call={call} />
            </section>
            <section className="card" aria-label="Workspace" style={{ padding: 12 }}>
              <div className="sv-rm-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>💻 Code editor</button>
                <button type="button" role="tab" aria-selected={tab === 'board'} onClick={() => setTab('board')}>✏️ Explanation board</button>
              </div>
              <div className="sv-rm-work">
                {/* Both stay mounted so neither misses live updates while hidden. */}
                <div style={{ display: tab === 'code' ? 'flex' : 'none', flex: 1, minWidth: 0 }}><Compiler store={codeStore} /></div>
                <div style={{ display: tab === 'board' ? 'flex' : 'none', flex: 1, minWidth: 0 }}><Whiteboard store={boardStore} /></div>
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="card" aria-label="People">
              <h2 style={{ marginBottom: 10 }}>People ({room.members?.length || 0})</h2>
              <ul className="sv-rm-people">
                {(room.members || []).map(m => (
                  <li key={m.id}>
                    <span className={`sv-rm-dot${online.includes(m.id) ? ' on' : ''}`} title={online.includes(m.id) ? 'Online' : 'Offline'} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}{m.id === me?.id ? ' (you)' : ''}
                    </span>
                    {m.role === 'host' && <span className="pill" style={{ height: 22 }}>👑 Host</span>}
                    {call?.members?.has(m.id) && <span title="In the call" aria-label="In the call">🎥</span>}
                    {room.is_host && m.role !== 'host' && (
                      <button type="button" className="sv-rm-btn sm" disabled={busy} aria-label={`Remove ${m.name}`}
                        onClick={() => { if (window.confirm(`Remove ${m.name} from the room?`)) act(() => api.removeRoomMember(code, m.id), loadRoom) }}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card sv-rm-chat" aria-label="Room chat">
              <h2 style={{ marginBottom: 8 }}>Room chat</h2>
              <div className="sv-rm-msgs" ref={msgsRef} aria-live="polite">
                {messages.length === 0 && <p className="muted" style={{ margin: 0 }}>No messages yet. Say hello 👋</p>}
                {messages.map(m => (
                  <div key={m.id} className={`sv-rm-msg${m.user_id === me?.id ? ' me' : ''}`}>
                    <span className="who">{m.user_id === room.host?.id ? '👑 ' : ''}{m.name} · {m.created_at ? new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at + 'Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    {m.text}
                  </div>
                ))}
              </div>
              <form onSubmit={sendChat} style={{ display: 'flex', gap: 8 }}>
                <input className="in" aria-label="Message" placeholder="Message everyone" value={draft} maxLength={1000}
                  onChange={e => setDraft(e.target.value)} />
                <button type="submit" className="sv-rm-btn p" disabled={!ws || !draft.trim()}>Send</button>
              </form>
            </section>
          </div>
        </div>
      </div></div>
      {shareOpen && <ShareToChat link={link} title={room.title} onClose={() => setShareOpen(false)} />}
    </SessionWebSocketContext.Provider>
  )
}
