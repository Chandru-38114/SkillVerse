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
  const [reviewedMap, setReviewedMap] = useState({})

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [inc, out] = await Promise.all([api.incomingRequests(), api.outgoingRequests()])
      setIncoming(inc)
      setOutgoing(out)

      const completed = [...inc, ...out].filter((r) => r.status === 'completed')
      const checks = await Promise.allSettled(
        completed.map((r) => api.getMyReviewForRequest(r.id))
      )
      const map = {}
      completed.forEach((r, i) => {
        map[r.id] = checks[i].status === 'fulfilled'
      })
      setReviewedMap(map)
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

  async function completeSession(id) {
    setError('')
    try {
      await api.completeRequest(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function markReviewed(requestId) {
    setReviewedMap((m) => ({ ...m, [requestId]: true }))
  }

  const list = tab === 'incoming' ? incoming : outgoing
  const incomingPending = incoming.filter((r) => r.status === 'pending').length

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <p className="label-eyebrow mb-1">My connections</p>
      <h1 className="font-display text-4xl mb-8">Requests</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-line pb-0">
        <TabButton
          label="Incoming"
          badge={incomingPending}
          active={tab === 'incoming'}
          onClick={() => setTab('incoming')}
        />
        <TabButton
          label="Sent"
          active={tab === 'outgoing'}
          onClick={() => setTab('outgoing')}
        />
      </div>

      {error && <p className="alert-error mb-4">{error}</p>}

      {loading ? (
        <RequestsSkeleton />
      ) : list.length === 0 ? (
        <EmptyRequests tab={tab} />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              tab={tab}
              onAccept={() => respond(r.id, true)}
              onDecline={() => respond(r.id, false)}
              onComplete={() => completeSession(r.id)}
              reviewed={reviewedMap[r.id]}
              onReviewed={() => markReviewed(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ r, tab, onAccept, onDecline, onComplete, reviewed, onReviewed }) {
  const otherName = tab === 'incoming' ? r.from_user_name : r.to_user_name

  return (
    <div className="card overflow-hidden">
      {/* Top stripe by status */}
      <div className={`h-0.5 ${
        r.status === 'accepted' ? 'bg-moss' :
        r.status === 'pending' ? 'bg-gold' :
        r.status === 'completed' ? 'bg-ink/20' :
        'bg-transparent'
      }`} />

      <div className="p-5">
        {/* Main row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-base">{otherName}</p>
              <span className="text-ink/25">·</span>
              <span className="text-sm text-ink/50">{r.skill_name}</span>
              <StatusPill status={r.status} />
            </div>
            {r.message && (
              <p className="text-sm text-ink/55 mt-2 italic leading-relaxed">
                "{r.message}"
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {tab === 'incoming' && r.status === 'pending' && (
              <>
                <button onClick={onAccept} className="btn-primary text-sm py-1.5 px-4">
                  Accept
                </button>
                <button onClick={onDecline} className="btn-secondary text-sm py-1.5 px-4">
                  Decline
                </button>
              </>
            )}

            {r.status === 'accepted' && (
              <>
                <Link to={`/chat/${r.id}`} className="btn-primary text-sm py-1.5 px-4">
                  Open chat
                </Link>
                <button
                  onClick={onComplete}
                  className="btn-secondary text-sm py-1.5 px-4 text-moss border-moss/30 hover:border-moss"
                  title="Mark session as complete — both participants earn +20 pts"
                >
                  Mark complete ✓
                </button>
              </>
            )}

            {r.status === 'declined' && (
              <span className="text-xs text-ink/35 italic">No further action</span>
            )}
          </div>
        </div>

        {/* Review panel */}
        {r.status === 'completed' && (
          <div className="mt-4 pt-4 border-t border-line">
            {reviewed ? (
              <p className="alert-success inline-flex items-center gap-1.5">
                <span>✓</span> Review submitted — thanks for the feedback!
              </p>
            ) : (
              <ReviewForm
                requestId={r.id}
                otherName={otherName}
                onSubmitted={onReviewed}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline review form ────────────────────────────────────────────────────────

function ReviewForm({ requestId, otherName, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating === 0) { setFormError('Please select a star rating.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      await api.submitReview(requestId, { rating, comment })
      onSubmitted()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-sm font-medium text-ink/70 mb-3">
        Rate your session with <span className="text-ink">{otherName}</span>
      </p>

      {/* Star picker */}
      <div className="flex gap-1 mb-3" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className={`text-2xl leading-none transition-all duration-100 hover:scale-110 active:scale-95 ${
              star <= (hovered || rating) ? 'text-gold' : 'text-ink/15'
            }`}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
        {(hovered || rating) > 0 && (
          <span className="text-xs text-ink/40 self-center ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][hovered || rating]}
          </span>
        )}
      </div>

      <textarea
        className="input text-sm h-20 mb-3"
        placeholder="Share what made this session valuable (optional)…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
      />

      {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}

      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="btn-primary text-sm py-2 px-5"
      >
        {submitting ? 'Submitting…' : 'Submit review (+5 pts)'}
      </button>
    </form>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick, badge = 0 }) {
  return (
    <button
      onClick={onClick}
      className={`relative text-sm px-4 py-2.5 font-medium border-b-2 transition-all duration-150 -mb-px ${
        active
          ? 'border-moss text-moss'
          : 'border-transparent text-ink/50 hover:text-ink'
      }`}
    >
      {label}
      {badge > 0 && (
        <span className="ml-1.5 bg-clay text-paper text-xs font-medium w-4 h-4 rounded-full inline-flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

function StatusPill({ status }) {
  const cls = {
    pending: 'status-pending',
    accepted: 'status-accepted',
    declined: 'status-declined',
    completed: 'status-completed',
  }[status] || ''

  const dot = {
    pending: '●',
    accepted: '●',
    declined: '○',
    completed: '✓',
  }[status] || ''

  return (
    <span className={cls}>
      <span className="text-[8px]">{dot}</span>
      {status}
    </span>
  )
}

function RequestsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card p-5">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-2 flex-1">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
            <div className="skeleton h-8 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyRequests({ tab }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-4xl mb-4">{tab === 'incoming' ? '📬' : '📤'}</p>
      <h2 className="font-display text-xl mb-2">
        {tab === 'incoming' ? 'No incoming requests' : 'No sent requests'}
      </h2>
      <p className="text-sm text-ink/50 max-w-xs mx-auto mb-6">
        {tab === 'incoming'
          ? 'When someone wants to learn from you, their request will appear here.'
          : 'Find a teacher in the marketplace and send your first request.'}
      </p>
      {tab === 'outgoing' && (
        <Link to="/marketplace" className="btn-primary">Browse teachers →</Link>
      )}
    </div>
  )
}