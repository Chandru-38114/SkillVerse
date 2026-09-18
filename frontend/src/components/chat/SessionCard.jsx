import React from 'react'
import { formatDateTime } from '../../utils/dateTime'
import { Calendar, Trash2, Clock, Play } from 'lucide-react'
import Avatar from '../ui/Avatar'

export default function SessionCard({ conv, onCancel, navigate }) {
  if (!conv?.session_id) return null
  const dateStr = conv.scheduled_start
    ? formatDateTime(conv.scheduled_start)
    : `${conv.session_date || ''} ${conv.session_time || ''}`.trim()

  return (
    <div className="mx-4 my-3 overflow-hidden rounded-2xl shadow-elev-1 border border-brand/20 bg-brandLight/10 transition-all hover:shadow-elev-2">
      <div className="h-1 w-full bg-brand" />
      <div className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
        <Avatar name={conv.other_user_name} url={conv.other_user_avatar} size="md" className="hidden sm:flex shrink-0 border-2 border-surface" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-lg text-ink truncate capitalize">
              Learning {conv.skill_name}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-moss/10 text-moss px-2 py-0.5 rounded-full">
              Scheduled
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-ink/70 mb-2 flex-wrap">
            <span className="font-medium text-ink">With {conv.other_user_name}</span>
            <span className="text-line">•</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {dateStr}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => onCancel(conv.session_id)}
            className="btn-secondary text-xs py-2 px-3 text-red-600 hover:bg-red-50"
            title="Cancel Session"
          >
            Cancel
          </button>
          <button
            onClick={() => navigate(`/session/${conv.session_id}`)}
            className="btn-primary text-sm py-2 px-5 flex items-center gap-1.5"
          >
            <Play className="w-4 h-4" /> Join
          </button>
        </div>
      </div>
    </div>
  )
}
