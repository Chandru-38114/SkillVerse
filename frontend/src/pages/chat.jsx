import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser } from '../api'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000

export default function Chat() {
  const { requestId } = useParams()
  const user = getSessionUser()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectionState, setConnectionState] = useState('connecting') // connecting | live | reconnecting | offline

  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS)
  const mountedRef = useRef(true)

  // Load message history once via REST (still the source of truth for
  // anything sent before this tab connected).
  useEffect(() => {
    setLoading(true)
    api.listMessages(requestId)
      .then((msgs) => mountedRef.current && setMessages(msgs))
      .catch((err) => mountedRef.current && setError(err.message))
      .finally(() => mountedRef.current && setLoading(false))
  }, [requestId])

  const connect = useCallback(() => {
    const ws = new WebSocket(chatSocketUrl(requestId))
    socketRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnectionState('live')
      setError('')
      reconnectDelayRef.current = RECONNECT_DELAY_MS
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      const incoming = JSON.parse(event.data)
      setMessages((prev) => {
        // Guard against duplicates if a reconnect races with a REST reload.
        if (prev.some((m) => m.id === incoming.id)) return prev
        return [...prev, incoming]
      })
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return
      socketRef.current = null
      // 4401/4403 are our own auth/authorization close codes — don't retry those.
      if (event.code === 4401 || event.code === 4403) {
        setConnectionState('offline')
        setError(
          event.code === 4401
            ? 'Your session expired — please log in again.'
            : "You don't have access to this conversation."
        )
        return
      }
      setConnectionState('reconnecting')
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, MAX_RECONNECT_DELAY_MS)
        connect()
      }, reconnectDelayRef.current)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [requestId])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
    }
  }, [connect])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    setDraft('')

    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content }))
      return
    }

    // Fallback to REST if the socket is down, so sending still works —
    // it just won't push to the other person until they reconnect/reload.
    try {
      const msg = await api.sendMessage(requestId, content)
      setMessages((prev) => [...prev, msg])
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col h-[calc(100vh-73px)]">
      <div className="flex items-center justify-between mb-4">
        <Link to="/requests" className="text-sm text-ink/50 hover:text-ink">&larr; Back to requests</Link>
        <ConnectionBadge state={connectionState} />
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="flex-1 overflow-y-auto card p-4 mb-4 space-y-3">
        {loading ? (
          <p className="text-ink/40 text-sm">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-ink/40 text-sm text-center py-8">
            No messages yet — say hello and set up your first session.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-sk text-sm ${
                  m.sender_id === user.id ? 'bg-moss text-paper' : 'bg-ink/5 text-ink'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="input"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn-primary shrink-0">Send</button>
      </form>
    </div>
  )
}

function ConnectionBadge({ state }) {
  const config = {
    connecting: { label: 'Connecting…', dot: 'bg-gold' },
    live: { label: 'Live', dot: 'bg-moss' },
    reconnecting: { label: 'Reconnecting…', dot: 'bg-clay animate-pulse' },
    offline: { label: 'Offline', dot: 'bg-ink/30' },
  }[state]

  return (
    <span className="flex items-center gap-1.5 text-xs text-ink/50 font-mono">
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}