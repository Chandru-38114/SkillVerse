import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'

const POLL_MS = 3000

export default function Chat() {
  const { requestId } = useParams()
  const user = getSessionUser()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const msgs = await api.listMessages(requestId)
      setMessages(msgs)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(interval)
  }, [requestId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!draft.trim()) return
    const content = draft
    setDraft('')
    try {
      await api.sendMessage(requestId, content)
      load(true)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col h-[calc(100vh-73px)]">
      <div className="flex items-center justify-between mb-4">
        <Link to="/requests" className="text-sm text-ink/50 hover:text-ink">&larr; Back to requests</Link>
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

      <p className="text-xs text-ink/30 mt-2">
        This is a simple polling chat (refreshes every {POLL_MS / 1000}s) — swap in a WebSocket
        connection for real-time delivery when you build the live classroom in Phase 2.
      </p>
    </div>
  )
}