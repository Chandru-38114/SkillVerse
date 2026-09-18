import { useEffect, useState } from 'react'
import { formatDate, formatTime , getTodayIstYMD} from '../utils/dateTime'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Calendar, Clock, CheckCircle2, XCircle, ArrowRight, Play, BookOpen } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { getSessionUser } from '../api'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming')
  const user = getSessionUser()

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
    if (!window.confirm("Are you sure you want to cancel this session?")) return;
    setError('')
    try {
      await api.cancelSession(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const upcoming = sessions.filter((s) => {
    if (s.status !== 'scheduled') return false;
    if (s.scheduled_end) {
      return new Date(s.scheduled_end) > new Date();
    }
    return s.session_date >= getTodayIstYMD();
  })
  
  const completed = sessions.filter(s => s.status === 'completed')
  
  const cancelled = sessions.filter(s => {
    if (s.status === 'cancelled') return true;
    if (s.status === 'scheduled' && s.scheduled_end) {
      return new Date(s.scheduled_end) < new Date() && !upcoming.includes(s) && !completed.includes(s);
    }
    return false;
  })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <p className="label-eyebrow mb-1">My schedule</p>
      <h1 className="font-display text-4xl mb-8">Sessions</h1>

      {error && <p className="alert-error mb-4">{error}</p>}

      {loading ? (
        <SessionsSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="flex border-b border-line overflow-x-auto scrollbar-hide">
            {['upcoming', 'completed', 'cancelled'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-semibold capitalize whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-clay hover:text-ink'
                }`}
              >
                {tab} 
                <span className="ml-2 text-xs bg-line/50 text-ink/50 px-2 py-0.5 rounded-full">
                  {tab === 'upcoming' ? upcoming.length : tab === 'completed' ? completed.length : cancelled.length}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-2">
            {activeTab === 'upcoming' && (
              upcoming.length > 0 ? (
                <div className="space-y-3">
                  {upcoming.map((s) => (
                    <SessionCard key={s.id} s={s} onCancel={() => handleCancel(s.id)} user={user} type="upcoming" />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Calendar className="w-8 h-8 text-brand" />} title="No upcoming sessions" desc="Connect with a peer to start your next learning session." />
              )
            )}
            
            {activeTab === 'completed' && (
              completed.length > 0 ? (
                <div className="space-y-3">
                  {completed.map((s) => (
                    <SessionCard key={s.id} s={s} user={user} type="completed" />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<CheckCircle2 className="w-8 h-8 text-moss" />} title="No completed sessions yet" desc="Your completed learning sessions will appear here." />
              )
            )}

            {activeTab === 'cancelled' && (
              cancelled.length > 0 ? (
                <div className="space-y-3">
                  {cancelled.map((s) => (
                    <SessionCard key={s.id} s={s} user={user} type="cancelled" />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<XCircle className="w-8 h-8 text-clay" />} title="No cancelled sessions" desc="You don't have any cancelled or expired sessions." />
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="card p-12 flex flex-col items-center justify-center text-center bg-surface/50 border-dashed">
      <div className="w-16 h-16 bg-brand/5 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="font-display font-bold text-lg mb-1">{title}</h2>
      <p className="text-sm text-clay max-w-xs">{desc}</p>
    </div>
  )
}

// ── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ s, onCancel, user, type }) {
  const dateLabel = formatDate(s.session_date)
  const timeLabel = `${s.start_time} – ${s.end_time}`

  const isExpired = s.status === 'scheduled' && s.scheduled_end && new Date(s.scheduled_end) < new Date();
  const isTutor = user?.id === s.tutor_id;
  const partnerName = isTutor ? s.learner_name : s.tutor_name;

  return (
    <div className={`card overflow-hidden transition-all hover:shadow-elev-1 ${type === 'cancelled' ? 'opacity-70' : ''}`}>
      <div className={`h-1 w-full ${type === 'upcoming' ? 'bg-brand' : type === 'completed' ? 'bg-moss' : 'bg-line'}`} />

      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
        <Avatar name={partnerName} size="md" className="hidden sm:flex shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-lg text-ink truncate capitalize">{s.skill}</span>
            <SessionStatusPill status={isExpired ? 'expired' : s.status} />
          </div>

          <div className="flex items-center gap-2 text-sm text-ink/70 mb-2 flex-wrap">
            <span className="font-medium text-ink">With {partnerName}</span>
            <span className="text-line">•</span>
            <span className="capitalize">{isTutor ? 'Teaching' : 'Learning'}</span>
            <span className="text-line">•</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {dateLabel}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {timeLabel}</span>
          </div>

          {s.notes && type !== 'cancelled' && (
            <div className="bg-lift/50 rounded-lg p-2.5 mt-2 flex items-start gap-2 border border-line/50">
              <BookOpen className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div className="text-xs text-ink/70 italic leading-relaxed line-clamp-2">"{s.notes}"</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2 mt-2 sm:mt-0">
          {type === 'upcoming' && !isExpired && (
            <>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="btn-secondary text-xs py-2 px-3 text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              )}
              <Link
                to={`/session/${s.id}`}
                className="btn-primary text-sm py-2 px-5 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" /> Join
              </Link>
            </>
          )}
          {type === 'completed' && (
            <div className="text-xs font-semibold text-moss bg-moss/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Completed
            </div>
          )}
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

export { SessionCard, SessionStatusPill }
