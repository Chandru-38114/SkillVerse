import { useEffect, useState } from 'react'
import { formatTime, getTodayIstYMD, createIstToUtcDate, IST_TIMEZONE } from '../utils/dateTime'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import './sessions.css'

const STS = {
  scheduled: ['● Scheduled', { background: '#D6F3EA' }],
  completed: ['✓ Completed', { background: '#FFFDF8' }],
  cancelled: ['○ Cancelled', { background: '#F0E5D2', color: '#6E6455', borderColor: '#8C8273' }],
  expired: ['◷ Missed', { background: '#FBEFC4' }],
}

/* ── date-stub helpers (IST) ─────────────────────────────────────────────── */

function istParts(s) {
  const raw = s.scheduled_start || s.session_date
  if (!raw) return { dow: '', d: '', m: '' }
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00+05:30` : raw)
  if (isNaN(d)) return { dow: '', d: '', m: '' }
  const fmt = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, ...opts }).format(d)
  return {
    dow: fmt({ weekday: 'short' }).toUpperCase(),
    d: fmt({ day: '2-digit' }),
    m: fmt({ month: 'short' }).toUpperCase(),
  }
}

function startDate(s) {
  if (s.scheduled_start) {
    const d = new Date(s.scheduled_start)
    if (!isNaN(d)) return d
  }
  if (s.session_date && s.start_time) {
    try { return createIstToUtcDate(s.session_date, s.start_time) } catch { /* ignore */ }
  }
  return null
}

function endDate(s) {
  if (s.scheduled_end) {
    const d = new Date(s.scheduled_end)
    if (!isNaN(d)) return d
  }
  if (s.session_date && s.end_time) {
    try { return createIstToUtcDate(s.session_date, s.end_time) } catch { /* ignore */ }
  }
  return null
}

function gapLabel(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming')
  const [confirmSession, setConfirmSession] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(() => Date.now())
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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  async function handleCancel(id) {
    setError('')
    setCancelling(true)
    try {
      await api.cancelSession(id)
      setConfirmSession(null)
      load()
    } catch (err) {
      setError(err.message)
      setConfirmSession(null)
    } finally {
      setCancelling(false)
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

  const list = activeTab === 'upcoming' ? upcoming : activeTab === 'completed' ? completed : cancelled
  const counts = { upcoming: upcoming.length, completed: completed.length, cancelled: cancelled.length }

  // NEXT UP — the soonest upcoming session
  const next = [...upcoming].sort((a, b) => {
    const da = startDate(a), db = startDate(b)
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0)
  })[0] || null

  let heroInfo = null
  if (next) {
    const isTutor = user?.id === next.tutor_id
    const st = startDate(next)
    const en = endDate(next)
    const live = st && en && now >= st.getTime() && now <= en.getTime()
    heroInfo = {
      s: next,
      isTutor,
      who: isTutor ? next.learner_name : next.tutor_name,
      role: isTutor ? 'Teaching' : 'Learning',
      live,
      cdLabel: live ? 'STARTED' : 'STARTS IN',
      cd: live ? gapLabel(now - st.getTime()) : (st ? gapLabel(st.getTime() - now) : '—'),
      joinText: live ? 'Join now' : 'Join',
      when: st ? `${new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(st)} · ${formatTime(st.toISOString())} – ${en ? formatTime(en.toISOString()) : ''}` : `${next.start_time} – ${next.end_time}`,
    }
  }

  const emptyCopy = {
    upcoming: { icon: '📅', title: 'No upcoming sessions', text: 'Connect with a peer to start your next learning session.', cta: true },
    completed: { icon: '✓', title: 'No completed sessions yet', text: 'Your completed learning sessions will appear here.', cta: false },
    cancelled: { icon: '○', title: 'No cancelled sessions', text: "You don't have any cancelled or expired sessions.", cta: false },
  }[activeTab]

  return (
    <div className="sv-sessions">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '44px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 30 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eb">MY SCHEDULE</span>
          <h1 style={{ margin: 0, fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>Sessions</h1>
        </div>

        {error && (
          <div className="card" style={{ padding: '14px 18px', background: '#F6DDD8', borderColor: '#9A2B1E', color: '#9A2B1E', fontWeight: 700 }}>{error}</div>
        )}

        {loading ? (
          <>
            <div className="sk" style={{ height: 200 }} />
            <div className="sk" style={{ height: 130 }} />
            <div className="sk" style={{ height: 130 }} />
          </>
        ) : (
          <>
            {/* NEXT UP hero */}
            {heroInfo && (
              <section className="card hero" aria-labelledby="sv-nx" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', overflow: 'hidden', background: '#29251F', color: '#FFFDF8', boxShadow: '0 4px 0 var(--accd), 0 7px 0 #29251F', backgroundImage: 'radial-gradient(#4A443A 1.6px, transparent 1.6px)', backgroundSize: '26px 26px' }}>
                <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {heroInfo.live ? (
                    <span className="pill" style={{ alignSelf: 'flex-start', background: '#E2533A', color: '#FFFDF8', borderColor: '#FFFDF8' }}>
                      <span className="live">●</span> LIVE NOW
                    </span>
                  ) : (
                    <span id="sv-nx" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#D9CBB2' }}>NEXT UP</span>
                  )}
                  <h2 style={{ margin: 0, fontSize: 34, fontWeight: 900, lineHeight: 1.1, textTransform: 'capitalize' }}>
                    {heroInfo.s.skill} with {heroInfo.who}
                  </h2>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span className="pill" style={{ background: heroInfo.isTutor ? '#D6F3EA' : '#E6DDF6', borderColor: '#FFFDF8' }}>{heroInfo.role}</span>
                    <span className="pill mono" style={{ background: 'transparent', color: '#FFFDF8', borderColor: '#FFFDF8' }}>{heroInfo.when}</span>
                  </div>
                  {heroInfo.s.notes && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', border: '2px dashed #6E6455', borderRadius: 10, fontSize: 14, color: '#D9CBB2' }}>
                      <span aria-hidden="true">📝</span>{heroInfo.s.notes}
                    </div>
                  )}
                </div>
                <div style={{ padding: 28, borderLeft: '2px dashed #6E6455', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minWidth: 220 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#D9CBB2' }}>{heroInfo.cdLabel}</span>
                  <span className="mono" style={{ fontSize: 40, lineHeight: 1 }}>{heroInfo.cd}</span>
                  <Link to={`/session/${heroInfo.s.id}`} className="btn btn-p" style={{ width: '100%', minHeight: 50 }}>▶ {heroInfo.joinText}</Link>
                  <button type="button" onClick={() => setConfirmSession(heroInfo.s)} style={{ color: '#F6A08F', fontSize: 13, fontWeight: 800, background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel session</button>
                </div>
              </section>
            )}

            <div>
              <div role="tablist" style={{ display: 'flex', gap: 8, paddingLeft: 12, flexWrap: 'wrap' }}>
                {[['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled & missed']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === key}
                    className={`tab${activeTab === key ? ' on' : ''}`}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}<span className="cnt">{counts[key]}</span>
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '2px solid #29251F', paddingTop: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {list.length === 0 ? (
                  <div className="card" style={{ padding: '44px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
                    <span style={{ width: 80, height: 80, borderRadius: 22, border: '2px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, transform: 'rotate(-5deg)', boxShadow: '0 5px 0 #29251F' }}>{emptyCopy.icon}</span>
                    <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900 }}>{emptyCopy.title}</h2>
                    <p className="muted" style={{ margin: 0, maxWidth: 380, fontSize: 15 }}>{emptyCopy.text}</p>
                    {emptyCopy.cta && <Link to="/marketplace" className="btn btn-p" style={{ marginTop: 6 }}>Find a partner →</Link>}
                  </div>
                ) : (
                  list.map((s) => (
                    <SessionCard
                      key={s.id}
                      s={s}
                      user={user}
                      type={activeTab}
                      onCancel={() => setConfirmSession(s)}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* cancel confirm */}
      {confirmSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(41,37,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 }}>
          <div className="card" role="alertdialog" aria-labelledby="sv-cx" style={{ maxWidth: 440, width: '100%', padding: 30, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#F6DDD8', color: '#9A2B1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, boxShadow: '0 5px 0 #29251F' }}>✕</span>
            <h3 id="sv-cx" style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Cancel this session?</h3>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
              <strong style={{ color: '#29251F', textTransform: 'capitalize' }}>
                {confirmSession.skill} with {user?.id === confirmSession.tutor_id ? confirmSession.learner_name : confirmSession.tutor_name}
              </strong><br />
              <span className="mono">{confirmSession.start_time} – {confirmSession.end_time}</span><br />
              {((user?.id === confirmSession.tutor_id ? confirmSession.learner_name : confirmSession.tutor_name) || 'They').split(' ')[0]} will see it as cancelled. You can schedule a new one from chat.
            </p>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button type="button" className="btn btn-s" style={{ flex: 1, minHeight: 50 }} onClick={() => setConfirmSession(null)}>Keep it</button>
              <button type="button" className="btn btn-d" style={{ flex: 1, minHeight: 50 }} disabled={cancelling} onClick={() => handleCancel(confirmSession.id)}>
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Session ticket ───────────────────────────────────────────────────────────

function SessionCard({ s, onCancel, user, type }) {
  const isExpired = s.status === 'scheduled' && s.scheduled_end && new Date(s.scheduled_end) < new Date();
  const isTutor = user?.id === s.tutor_id;
  const partnerName = isTutor ? s.learner_name : s.tutor_name;

  const statusKey = isExpired ? 'expired' : s.status
  const sts = STS[statusKey] || STS.scheduled
  const dim = statusKey === 'cancelled' || statusKey === 'expired'
  const { dow, d, m } = istParts(s)
  const timeLabel = `${s.start_time} – ${s.end_time}`

  return (
    <article className="card ticket" style={dim ? { opacity: .78 } : undefined}>
      <div className="date" style={{ background: statusKey === 'scheduled' ? 'var(--accl)' : '#F0E5D2' }}>
        <span className="eb" style={{ color: '#29251F' }}>{dow}</span>
        <span className="mono" style={{ fontSize: 34, lineHeight: 1 }}>{d}</span>
        <span style={{ fontSize: 12, fontWeight: 800 }}>{m}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 19, textTransform: 'capitalize' }}>{s.skill}</strong>
            <span className="pill" style={{ background: isTutor ? '#D6F3EA' : '#E6DDF6' }}>{isTutor ? 'Teaching' : 'Learning'}</span>
            <span className="pill" style={sts[1]}>{sts[0]}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>With {partnerName} · <span className="mono">{timeLabel}</span></span>
          {s.notes && !dim && (
            <span style={{ fontSize: 14, fontWeight: 600, paddingLeft: 10, borderLeft: '4px solid var(--acc)' }}>{s.notes}</span>
          )}
        </div>
        <div className="acts" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {type === 'upcoming' && !isExpired && (
            <>
              {onCancel && <button type="button" className="btn btn-s" style={{ color: '#9A2B1E' }} onClick={onCancel}>Cancel</button>}
              <Link to={`/session/${s.id}`} className="btn btn-p">▶ Join</Link>
            </>
          )}
          {statusKey === 'completed' && (
            <Link to={`/quest-review/${s.id}`} className="btn btn-s">View recap →</Link>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Status pill (kept for other pages that import it) ────────────────────────

function SessionStatusPill({ status }) {
  const sts = STS[status] || STS.scheduled
  return <span className="pill" style={sts[1]}>{sts[0]}</span>
}

export { SessionCard, SessionStatusPill }
