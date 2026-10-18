import { useState } from 'react'
import { createIstToUtcDate, getTodayIstYMD } from '../../utils/dateTime'
import { api } from '../../api'

export default function ScheduleModal({ requestId, onClose, onScheduled }) {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const today = getTodayIstYMD()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!date || !startTime || !endTime) { setError('Date, start and end time are required.'); return }
    const start = createIstToUtcDate(date, startTime)
    const end = createIstToUtcDate(date, endTime)
    if (!start || !end) { setError('Invalid date/time values.'); return }
    setError('')
    setSubmitting(true)
    try {
      const session = await api.createSession({
        request_id: requestId,
        session_date: date,
        start_time: startTime,
        end_time: endTime,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        notes: notes || null,
      })
      onScheduled(session)
    } catch (err) {
      setError(err.message || 'Failed to schedule session')
    } finally {
      setSubmitting(false)
    }
  }

  // Clicking the text part of a native date/time box only selects the digits;
  // the calendar/clock opens only from the small icon, which is easy to miss
  // (and nearly invisible when the browser is in dark mode). Open the picker
  // on any click, and force light colours so the icon is always visible.
  const openPicker = (e) => { try { e.currentTarget.showPicker?.() } catch { /* older browsers: typing still works */ } }
  const pickerStyle = { colorScheme: 'light', cursor: 'pointer' }

  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 700, fontSize: 14 }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(41,37,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 5 }}>
      <form className="card" role="dialog" aria-labelledby="sv-sched" style={{ width: '100%', maxWidth: 440, overflow: 'hidden', maxHeight: '100%', overflowY: 'auto' }} onSubmit={handleSubmit}>
        <div style={{ padding: '18px 22px', borderBottom: '2px solid #29251F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accl)' }}>
          <h3 id="sv-sched" style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Schedule session</h3>
          <button type="button" className="icb" aria-label="Close" style={{ width: 34, height: 34 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={labelStyle}>
            Date
            <input className="in" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} onClick={openPicker} style={pickerStyle} required />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Start
              <input className="in" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} onClick={openPicker} style={pickerStyle} required />
            </label>
            <label style={labelStyle}>
              End
              <input className="in" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} onClick={openPicker} style={pickerStyle} required />
            </label>
          </div>

          <label style={labelStyle}>
            Notes
            <input className="in" placeholder="Agenda or topics to discuss" value={notes} onChange={e => setNotes(e.target.value)} />
          </label>

          {error && (
            <div style={{ padding: '10px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 700, fontSize: 13 }}>
              {error}
            </div>
          )}

          {date && startTime && endTime && !error && (
            <div style={{ padding: '12px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA' }}>
              <span className="eb" style={{ color: '#29251F' }}>SESSION SUMMARY</span>
              <div style={{ fontWeight: 800, marginTop: 4 }}>
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {startTime} to {endTime}{' '}
                <span className="muted" style={{ fontWeight: 600 }}>IST</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-s" style={{ flex: 1, minHeight: 48 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-p" style={{ flex: 1, minHeight: 48 }} disabled={submitting || !date || !startTime || !endTime}>
              {submitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
