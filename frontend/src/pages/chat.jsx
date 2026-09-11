import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, chatSocketUrl, getSessionUser } from '../api'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 10000

export default function Chat({ embeddedRequestId, embedded }) {
  const { requestId: paramRequestId } = useParams()
  const requestId = embeddedRequestId || paramRequestId
  const user = getSessionUser()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectionState, setConnectionState] = useState('connecting')

  const bottomRef = useRef(null)
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS)
  const mountedRef = useRef(true)
  const inputRef = useRef(null)

  // Load message history once via REST.
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
        if (prev.some((m) => m.id === incoming.id)) return prev
        return [...prev, incoming]
      })
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return
      socketRef.current = null
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

    ws.onerror = () => { ws.close() }
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
    inputRef.current?.focus()

    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ content }))
      return
    }

    // Fallback to REST if socket is down.
    try {
      const msg = await api.sendMessage(requestId, content)
      setMessages((prev) => [...prev, msg])
    } catch (err) {
      setError(err.message)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className={embedded ? "flex-1 flex flex-col h-full min-h-0 bg-white" : "max-w-2xl mx-auto px-6 py-6 flex flex-col h-[calc(100vh-56px)]"}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
        <Link
          to="/requests"
          className="flex items-center gap-2 text-sm text-ink/50 hover:text-ink transition-colors"
        >
          <span>←</span>
          <span>Back to requests</span>
        </Link>
        <ConnectionBadge state={connectionState} />
      </div>

      {error && <p className="alert-error mb-3">{error}</p>}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1">
        {loading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-3xl mb-3">💬</p>
              <p className="text-sm text-ink/40 font-medium">No messages yet</p>
              <p className="text-xs text-ink/30 mt-1">Say hello and set up your first session.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, idx) => {
              const isMe = Number(m.sender_id) === Number(user?.id)
              const prevIsMe = idx > 0 && Number(messages[idx - 1].sender_id) === Number(user?.id)
              const isConsecutive = idx > 0 && messages[idx - 1].sender_id === m.sender_id
              return (
                <div
                  key={m.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}
                >
                  <div
                    className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-moss text-paper rounded-br-md'
                        : 'bg-white border border-line text-ink rounded-bl-md shadow-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input row */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          ref={inputRef}
          className="input flex-1"
          placeholder="Type a message… (Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="btn-primary shrink-0 px-5"
        >
          Send
        </button>
      </form>
    </div>
  )
}

function ConnectionBadge({ state }) {
  const config = {
    connecting: { label: 'Connecting…', dot: 'bg-gold animate-pulse' },
    live: { label: 'Live', dot: 'bg-moss' },
    reconnecting: { label: 'Reconnecting…', dot: 'bg-clay animate-pulse' },
    offline: { label: 'Offline', dot: 'bg-ink/30' },
  }[state]

  return (
    <span className="flex items-center gap-1.5 text-xs text-ink/40 font-mono">
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function ChatSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      {[false, true, false, true, false].map((isRight, i) => (
        <div key={i} className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
          <div className={`skeleton h-9 rounded-2xl ${isRight ? 'w-48' : 'w-64'}`} />
        </div>
      ))}
    </div>
  )
}


