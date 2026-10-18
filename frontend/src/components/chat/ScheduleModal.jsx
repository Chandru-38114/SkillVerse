import { useEffect, useMemo, useState } from 'react'
import { createIstToUtcDate, getTodayIstYMD } from '../../utils/dateTime'
import { api } from '../../api'

// Session rules (the server checks them too): 15 min – 3 h, up to 60 days ahead,
// start and end on the same day. All times are IST.
const DAYS_AHEAD = 60
const DAYS_PER_PAGE = 14
const DURATIONS = [15, 30, 45, 60, 90, 120, 180]
const SLOT_GROUPS = [
  { label: 'Morning', from: 6 * 60, to: 12 * 60 },
  { label: 'Afternoon', from: 12 * 60, to: 17 * 60 },
  { label: 'Evening', from: 17 * 60, to: 23 * 60 + 30 },
]

const pad = (n) => String(n).padStart(2, '0')
const toHHMM = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
const to12h = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}
const durLabel = (d) => (d < 60 ? `${d} min` : `${d / 60} h`.replace('.5 h', '½ h'))

function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function dayInfo(ymd, i) {
  const d = new Date(`${ymd}T00:00:00Z`)
  return {
    ymd,
    top: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    rel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : null,
    num: d.getUTCDate(),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
  }
}

const chip = (on, disabled) => ({
  border: '2px solid #29251F', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
  background: on ? 'var(--acc)' : '#FFFDF8', color: '#29251F', fontWeight: 800,
  boxShadow: on ? '0 1px 0 #29251F' : '0 3px 0 #29251F', transform: on ? 'translateY(2px)' : 'none',
  opacity: disabled ? 0.35 : 1, transition: 'transform .08s, box-shadow .08s', fontFamily: 'inherit',
})

export default function ScheduleModal({ requestId, onClose, onScheduled }) {
  const today = getTodayIstYMD()
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => dayInfo(addDays(today, i), i)), [today])
  const [page, setPage] = useState(0)
  const [date, setDate] = useState(today)
  const [start, setStart] = useState(null)      // minutes after midnight (IST)
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())   // refreshed so past slots disappear
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // Slots in the past (today) can't be picked.
  const isPast = (mins) => {
    const at = createIstToUtcDate(date, toHHMM(mins))
    return !at || at.getTime() < now + 2 * 60 * 1000
  }
  const slotsOf = (g) => {
    const out = []
    for (let m = g.from; m < g.to; m += 30) if (!isPast(m)) out.push(m)
    return out
  }
  const [groupPick, setGroupPick] = useState(null)
  // Show the chosen part of the day, else the first one that still has times.
  const group = groupPick || (SLOT_GROUPS.find(g => slotsOf(g).length > 0) || SLOT_GROUPS[0]).label
  const end = start == null ? null : start + duration
  const crossesMidnight = (s, d) => s + d > 23 * 60 + 59

  function pickDay(ymd) {
    setDate(ymd)
    setError('')
    setGroupPick(null)
    if (start != null && ymd === today) {
      const at = createIstToUtcDate(ymd, toHHMM(start))
      if (!at || at.getTime() < now) setStart(null)
    }
  }

  function nudge(delta) {
    const next = start + delta
    if (next < 0 || isPast(next) || crossesMidnight(next, duration)) return
    setStart(next)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (start == null) { setError('Pick a start time.'); return }
    if (crossesMidnight(start, duration)) { setError('A session must end on the same day.'); return }
    const startTime = toHHMM(start), endTime = toHHMM(end)
    const s = createIstToUtcDate(date, startTime)
    const en = createIstToUtcDate(date, endTime)
    if (!s || !en) { setError('Invalid date/time values.'); return }
    setError('')
    setSubmitting(true)
    try {
      const session = await api.createSession({
        request_id: requestId,
        session_date: date,
        start_time: startTime,
        end_time: endTime,
        scheduled_start: s.toISOString(),
        scheduled_end: en.toISOString(),
        notes: notes || null,
      })
      onScheduled(session)
    } catch (err) {
      setError(err.message || 'Failed to schedule session')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleDays = days.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE)
  const lastPage = Math.ceil(DAYS_AHEAD / DAYS_PER_PAGE) - 1
  const chosen = days.find(d => d.ymd === date)
  const eb = { fontSize: 11, letterSpacing: '0.12em', fontWeight: 900, color: '#29251F' }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(41,37,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, zIndex: 5 }}>
      <form className="card" role="dialog" aria-labelledby="sv-sched" onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', background: '#FBF5EA', padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '2px solid #29251F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accl)' }}>
          <h3 id="sv-sched" style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>📅 Schedule session</h3>
          <button type="button" className="icb" aria-label="Close" style={{ width: 34, height: 34 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 1. Day */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={eb}>1 · PICK A DAY</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label="Earlier dates" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ ...chip(false, page === 0), width: 32, height: 30 }}>‹</button>
                <button type="button" aria-label="Later dates" disabled={page === lastPage} onClick={() => setPage(p => p + 1)} style={{ ...chip(false, page === lastPage), width: 32, height: 30 }}>›</button>
              </span>
            </div>
            <div role="listbox" aria-label="Day" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
              {visibleDays.map(d => (
                <button key={d.ymd} type="button" role="option" aria-selected={d.ymd === date} aria-label={`${d.rel ? d.rel + ', ' : ''}${d.top} ${d.num} ${d.month}`} title={d.rel || undefined}
                  onClick={() => pickDay(d.ymd)}
                  style={{ ...chip(d.ymd === date), ...(d.rel === 'Today' ? { borderStyle: 'dashed' } : {}), padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.8, maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>{d.top.toUpperCase()}</span>
                  <span style={{ fontSize: 17, fontWeight: 900 }}>{d.num}</span>
                  <span style={{ fontSize: 10, fontWeight: 700 }}>{d.month}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Start time */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={eb}>2 · START TIME <span style={{ fontWeight: 700, letterSpacing: 0, opacity: 0.7 }}>(IST)</span></span>
            <div role="group" aria-label="Part of the day" style={{ display: 'flex', gap: 4, padding: 4, border: '2px solid #29251F', borderRadius: 14, background: '#F0E5D2', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
              {SLOT_GROUPS.map(g => {
                const on = group === g.label, empty = slotsOf(g).length === 0
                return (
                  <button key={g.label} type="button" aria-pressed={on} disabled={empty} onClick={() => setGroupPick(g.label)}
                    style={{ border: on ? '2px solid #29251F' : '2px solid transparent', borderRadius: 10, padding: '5px 12px', fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
                      background: on ? '#FFFDF8' : 'transparent', color: '#29251F', cursor: empty ? 'not-allowed' : 'pointer', opacity: empty ? 0.4 : 1 }}>
                    {g.label}
                  </button>
                )
              })}
            </div>
            {(() => {
              const slots = slotsOf(SLOT_GROUPS.find(g => g.label === group))
              if (slots.length === 0) return <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>No times left today. Pick another day.</span>
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 6 }}>
                  {slots.map(m => {
                    const on = start != null && start >= m && start < m + 30
                    return (
                      <button key={m} type="button" aria-pressed={on} onClick={() => { setStart(m); setError('') }}
                        style={{ ...chip(on), padding: '7px 4px', fontSize: 13 }}>
                        {on ? to12h(start) : to12h(m)}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
            {start != null && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Starts {to12h(start)} · fine-tune:</span>
                <button type="button" onClick={() => nudge(-15)} style={{ ...chip(false), padding: '3px 10px', fontSize: 12 }}>−15 min</button>
                <button type="button" onClick={() => nudge(15)} style={{ ...chip(false), padding: '3px 10px', fontSize: 12 }}>+15 min</button>
              </div>
            )}
          </div>

          {/* 3. Duration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={eb}>3 · HOW LONG</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DURATIONS.map(d => {
                const disabled = start != null && crossesMidnight(start, d)
                return (
                  <button key={d} type="button" aria-pressed={duration === d} disabled={disabled}
                    onClick={() => { setDuration(d); setError('') }}
                    style={{ ...chip(duration === d, disabled), padding: '6px 12px', fontSize: 13 }}>
                    {durLabel(d)}
                  </button>
                )
              })}
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eb}>NOTES <span style={{ fontWeight: 700, letterSpacing: 0, opacity: 0.7 }}>(optional)</span></span>
            <input className="in" placeholder="Agenda or topics to discuss" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} />
          </label>

          {error && (
            <div role="alert" style={{ padding: '10px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 700, fontSize: 13 }}>
              {error}
            </div>
          )}

          {start != null && chosen && (
            <div style={{ padding: '12px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA', transform: 'rotate(-0.6deg)', boxShadow: '0 3px 0 #29251F' }}>
              <span style={eb}>SESSION SUMMARY</span>
              <div style={{ fontWeight: 800, marginTop: 4 }}>
                {chosen.rel || chosen.top},{' '}
                {chosen.num} {chosen.month} · {to12h(start)} – {to12h(end)}{' '}
                <span className="muted" style={{ fontWeight: 600 }}>IST · {durLabel(duration)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-s" style={{ flex: 1, minHeight: 48 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-p" style={{ flex: 1, minHeight: 48 }} disabled={submitting || start == null}>
              {submitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
