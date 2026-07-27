import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'

export default function Requests() {
  const user = getSessionUser()
  const [tab, setTab] = useState('incoming')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [inc, out] = await Promise.all([api.incomingRequests(), api.outgoingRequests()])
      setIncoming(inc)
      setOutgoing(out)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function respond(id, accept) {
    setError('')
    try {
      await api.respondToRequest(id, accept)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const list = tab === 'incoming' ? incoming : outgoing

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="label-eyebrow mb-1">Connections</p>
      <h1 className="font-display text-3xl mb-8">Requests</h1>

      <div className="flex gap-2 mb-6">
        <TabButton label="Incoming" active={tab === 'incoming'} onClick={() => setTab('incoming')} />
        <TabButton label="Sent" active={tab === 'outgoing'} onClick={() => setTab('outgoing')} />
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center text-ink/60">
          {tab === 'incoming' ? "No one has requested to learn from you yet." : "You haven't sent any requests yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="card p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {tab === 'incoming' ? r.from_user_name : r.to_user_name}
                  <span className="text-ink/40 font-normal"> · {r.skill_name}</span>
                </p>
                {r.message && <p className="text-sm text-ink/60 mt-1">"{r.message}"</p>}
                <StatusPill status={r.status} />
              </div>

              <div className="flex gap-2 shrink-0">
                {tab === 'incoming' && r.status === 'pending' && (
                  <>
                    <button onClick={() => respond(r.id, true)} className="btn-primary text-sm py-1.5">Accept</button>
                    <button onClick={() => respond(r.id, false)} className="btn-secondary text-sm py-1.5">Decline</button>
                  </>
                )}
                {r.status === 'accepted' && (
                  <Link to={`/chat/${r.id}`} className="btn-secondary text-sm py-1.5">Open chat</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-sk border ${active ? 'border-moss bg-moss/5 text-moss' : 'border-line text-ink/60'}`}
    >
      {label}
    </button>
  )
}

function StatusPill({ status }) {
  const styles = {
    pending: 'text-gold',
    accepted: 'text-moss',
    declined: 'text-ink/40',
  }
  return <p className={`text-xs font-mono mt-1 ${styles[status] || ''}`}>{status}</p>
}