import React, { useState } from 'react'
import { createIstToUtcDate, getTodayIstYMD } from '../../utils/dateTime'
import { api } from '../../api'
import { X, FileText } from 'lucide-react'
import DateTimePicker from '../DateTimePicker'

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-elev-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-line/40 bg-surface">
          <h3 className="font-display font-bold text-lg text-ink">Schedule Session</h3>
          <button onClick={onClose} className="p-1.5 text-clay hover:bg-line/50 hover:text-ink rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <DateTimePicker 
            date={date}
            startTime={startTime}
            endTime={endTime}
            onDateChange={setDate}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            minDate={today}
          />

          <div>
            <label className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-clay" />
              Notes (Optional)
            </label>
            <input type="text" className="input" placeholder="Agenda or topics to discuss" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}

          {date && startTime && endTime && !error && (
            <div className="p-4 bg-brand/5 border border-brand/20 rounded-xl mt-4">
               <p className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1">Session Summary</p>
               <p className="text-sm text-ink font-medium">
                 {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {startTime} to {endTime} <span className="text-clay font-normal ml-1">IST</span>
               </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-line/40">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting || !date || !startTime || !endTime} className="btn-primary flex-1">{submitting ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
