import React from 'react'
import { formatDateTime } from '../../utils/dateTime'
import { Calendar, Trash2 } from 'lucide-react'

export default function SessionCard({ conv, onCancel, navigate }) {
  if (!conv?.session_id) return null
  const dateStr = conv.scheduled_start
    ? formatDateTime(conv.scheduled_start)
    : `${conv.session_date || ''} ${conv.session_time || ''}`.trim()

  return (
    <div className="mx-4 my-3 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-brandLight/30 rounded-2xl shadow-elev-1">
      <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
        <Calendar className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-ink text-sm">Session Scheduled</p>
        <p className="text-clay text-xs mt-0.5 truncate uppercase tracking-wide font-bold">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
        <button onClick={() => navigate(`/session/${conv.session_id}`)} className="flex-1 sm:flex-none btn-primary text-xs px-4 py-2 h-auto shadow-sm">
          Join
        </button>
        <button onClick={() => onCancel(conv.session_id)} className="p-2 text-clay hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-lg flex items-center justify-center border border-transparent hover:border-red-500/20">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
