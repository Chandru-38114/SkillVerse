import { createIstToUtcDate, formatDate } from '../utils/dateTime'
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
                <Link to={`/messages?request_id=${r.id}`} className="btn-primary text-sm py-1.5 px-4">
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

        {/* Two-way learning context panel — shown on incoming requests */}
        <LearningContext r={r} tab={tab} />

        {/* For accepted: direct user to Connect to schedule */}
        {r.status === 'accepted' && (
          <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
            <p className="text-xs text-ink/50 flex-1">💬 Use <strong>Connect</strong> to chat and schedule a session with this person.</p>
          </div>
        )}

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


// ── Two-way learning context panel ───────────────────────────────────────────

function LearningContext({ r, tab }) {
  const hasLearnInfo = r.learner_current_level || r.learner_topics || r.learner_goals
  const hasTeachInfo = r.learner_can_teach || r.learner_teach_proficiency

  if (!hasLearnInfo && !hasTeachInfo) return null

  return (
    <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-2 gap-4">
      {/* What the learner wants to learn */}
      {hasLearnInfo && (
        <div>
          <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">
            {tab === 'incoming' ? 'They want to learn' : 'You want to learn'}
          </p>
          <div className="space-y-1.5">
            {r.learner_current_level && (
              <div className="flex gap-2 text-sm">
                <span className="text-ink/40 w-24 shrink-0">Current level</span>
                <span className="font-medium">{r.learner_current_level}</span>
              </div>
            )}
            {r.learner_topics && (
              <div className="flex gap-2 text-sm">
                <span className="text-ink/40 w-24 shrink-0">Topics</span>
                <span>{r.learner_topics}</span>
              </div>
            )}
            {r.learner_goals && (
              <div className="flex gap-2 text-sm">
                <span className="text-ink/40 w-24 shrink-0">Goals</span>
                <span>{r.learner_goals}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* What the learner can teach */}
      {hasTeachInfo && (
        <div>
          <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">
            {tab === 'incoming' ? 'They can teach' : 'You offered to teach'}
          </p>
          <div className="space-y-1.5">
            {r.learner_can_teach && (
              <div className="flex gap-2 text-sm">
                <span className="text-ink/40 w-24 shrink-0">Skills</span>
                <span>{r.learner_can_teach}</span>
              </div>
            )}
            {r.learner_teach_proficiency && (
              <div className="flex gap-2 text-sm">
                <span className="text-ink/40 w-24 shrink-0">Proficiency</span>
                <span className="font-medium">{r.learner_teach_proficiency}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Schedule session panel ────────────────────────────────────────────────────

function SchedulePanel({ requestId, skill }) {
  const [session, setSession] = useState(null)   // existing session or null
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadSession() {
    // Fetch upcoming sessions and find one matching this request
    try {
      const sessions = await api.mySessions()
      const match = sessions.find(
        (s) => s.request_id === requestId && s.status === 'scheduled'
      )
      setSession(match || null)
    } catch {
      // non-fatal — just show the form
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSession() }, [requestId])

  async function handleCancel() {
    if (!session) return
    setError('')
    try {
      await api.cancelSession(session.id)
      setSession(null)
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function onScheduled(newSession) {
    setSession(newSession)
    setShowForm(false)
  }

  if (loading) return null

  return (
    <div className="mt-4 pt-4 border-t border-line">
      {error && <p className="alert-error mb-3 text-xs">{error}</p>}

      {session ? (
        /* ── Scheduled session display ── */
        <div>
          <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">
            Scheduled Session
          </p>
          <div className="bg-brand/5 dark:bg-brand/10 border border-moss/20 rounded-lg p-3 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-moss capitalize">{session.skill}</span>
                <span className="text-xs bg-brand/10 dark:bg-brand/20 text-moss border border-moss/20 px-1.5 py-0.5 rounded-full font-medium">
                  Scheduled ●
                </span>
              </div>
              <p className="text-sm text-ink/70">
                📅 {formatDate(session.scheduled_start || session.session_date)}{' '}
                <span className="text-ink/40 mx-1">·</span>
                ⏰ {session.start_time} – {session.end_time}
              </p>
              {session.notes && (
                <p className="text-xs text-ink/50 italic">{session.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/session/${session.id}`}
                className="btn-primary text-xs py-1.5 px-3"
              >
                Join
              </Link>
              <button
                onClick={handleCancel}
                className="text-xs text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : showForm ? (
        /* ── Schedule form ── */
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">
              Schedule Session
            </p>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-ink/40 hover:text-ink"
            >
              ✕ Close
            </button>
          </div>
          <ScheduleForm
            requestId={requestId}
            skill={skill}
            onScheduled={onScheduled}
          />
        </div>
      ) : (
        /* ── Button to open form ── */
        <button
          onClick={() => setShowForm(true)}
          className="btn-secondary text-sm py-1.5 px-4 w-full"
        >
          📅 Schedule Session
        </button>
      )}
    </div>
  )
}

// ── Schedule form ─────────────────────────────────────────────────────────────

function ScheduleForm({ requestId, skill, onScheduled }) {
  const today = getTodayIstYMD()
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!date || !start || !end) {
      setFormError('Date, start time, and end time are required.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const created = await api.createSession({
        request_id: requestId,
        session_date: date,
        start_time: start,
        end_time: end,
          scheduled_start: createIstToUtcDate(date, start).toISOString(),
          scheduled_end: createIstToUtcDate(date, end).toISOString(),
        notes: notes || null,
      })
      onScheduled(created)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="field-label text-xs">Date</label>
          <input
            type="date"
            className="input text-sm"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label text-xs">Start time</label>
          <input
            type="time"
            className="input text-sm"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label text-xs">End time</label>
          <input
            type="time"
            className="input text-sm"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="field-label text-xs">Notes / agenda (optional)</label>
        <input
          className="input text-sm"
          placeholder="What will you cover in this session?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {formError && <p className="alert-error text-xs py-2">{formError}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary text-sm py-2 w-full"
      >
        {submitting ? 'Scheduling…' : 'Confirm Session'}
      </button>
    </form>
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
