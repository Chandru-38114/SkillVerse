import { useEffect, useState } from 'react'
import { formatDate, formatTime } from '../utils/dateTime'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Calendar, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.mySessions()
      setSessions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCancel(id) {
    setError('')
    try {
      await api.cancelSession(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const upcoming = sessions.filter(
    (s) => s.status === 'scheduled' && s.session_date >= new Date().toISOString().slice(0, 10)
  )
  const past = sessions.filter((s) => !upcoming.includes(s))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <p className="label-eyebrow mb-1">My schedule</p>
      <h1 className="font-display text-4xl mb-8">Sessions</h1>

      {error && <p className="alert-error mb-4">{error}</p>}

      {loading ? (
        <SessionsSkeleton />
      ) : sessions.length === 0 ? (
        <EmptySessions />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink/50 uppercase tracking-wide mb-3">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((s) => (
                  <SessionCard key={s.id} s={s} onCancel={() => handleCancel(s.id)} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink/50 uppercase tracking-wide mb-3">
                Past / Cancelled
              </h2>
              <div className="space-y-3">
                {past.map((s) => (
                  <SessionCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ s, onCancel }) {
  const dateLabel = formatDate(s.session_date)
  const timeLabel = `${s.start_time} – ${s.end_time}`

  return (
    <div className="card overflow-hidden">
      <div className={`h-0.5 ${
        s.status === 'scheduled'  ? 'bg-moss' :
        s.status === 'completed'  ? 'bg-ink/20' :
        s.status === 'cancelled'  ? 'bg-transparent' :
        'bg-transparent'
      }`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Skill + status */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-base capitalize">{s.skill}</span>
              <SessionStatusPill status={s.status} />
            </div>

            {/* Participants */}
            <p className="text-sm text-ink/55 mb-3">
              <span className="text-ink/40">Tutor:</span>{' '}
              <span className="font-medium">{s.tutor_name}</span>
              <span className="mx-2 text-ink/25">·</span>
              <span className="text-ink/40">Learner:</span>{' '}
              <span className="font-medium">{s.learner_name}</span>
            </p>

            {/* Date & time */}
            <div className="flex items-center gap-4 text-sm text-ink/60">
              <span>📅 {dateLabel}</span>
              <span>⏰ {timeLabel}</span>
            </div>

            {s.notes && (
              <p className="text-sm text-ink/50 mt-2 italic">"{s.notes}"</p>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-2">
            {s.status === 'scheduled' && (
              <Link
                to={`/session/${s.id}`}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Join Session
              </Link>
            )}
            {s.status === 'scheduled' && onCancel && (
              <button
                onClick={onCancel}
                className="btn-secondary text-xs py-1.5 px-3 text-red-600 border-red-200 hover:border-red-400"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────

function SessionStatusPill({ status }) {
  const cls = {
    scheduled: 'status-accepted',
    completed: 'status-completed',
    cancelled: 'status-declined',
  }[status] || 'status-pill bg-ink/5 text-ink/40'

  const dot = {
    scheduled: '●',
    completed: '✓',
    cancelled: '○',
  }[status] || ''

  return (
    <span className={cls}>
      <span className="text-[8px]">{dot}</span>
      {status}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────



function SessionsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-3 w-56 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
      ))}
    </div>
  )
}

function EmptySessions() {
  return (
    <div className="card p-12 text-center">
      <p className="text-4xl mb-4">📅</p>
      <h2 className="font-display text-xl mb-2">No sessions yet</h2>
      <p className="text-sm text-ink/50 max-w-xs mx-auto">
        Accept a connection request and schedule your first learning session.
      </p>
    </div>
  )
}

export { SessionCard, SessionStatusPill }
