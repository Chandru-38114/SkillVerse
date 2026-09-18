import React, { useState } from 'react'
import Avatar from '../ui/Avatar'

export default function PendingRequestCard({ req, onAccept, onDecline }) {
  const [submitting, setSubmitting] = useState(false)

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true)
    try {
      await onAccept(req.id)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (submitting) return;
    setSubmitting(true)
    try {
      await onDecline(req.id)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 bg-brandLight/20 rounded-2xl shadow-elev-1 relative overflow-hidden mb-3 mx-2 sm:mx-0">
      {/* Decorative indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand"></div>
      
      <div className="flex items-start gap-3">
        <Avatar url={req.from_user_avatar} name={req.from_user_name} size="md" className="shrink-0 shadow-sm" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">
            {req.from_user_name}
          </p>
          <p className="text-xs text-clay truncate mt-0.5">
            Wants to learn <span className="font-medium text-ink">{req.skill_name}</span>
          </p>
          
          {req.message && (
            <div className="mt-2 text-xs text-ink/80 italic bg-lift/50 p-2.5 rounded-xl border border-line/40">
              "{req.message}"
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-3">
            <button 
              onClick={handleAccept} 
              disabled={submitting}
              className="btn-primary flex-1 py-2 text-xs min-h-[36px]"
            >
              Accept
            </button>
            <button 
              onClick={handleDecline}
              disabled={submitting} 
              className="btn-ghost flex-1 py-2 text-xs min-h-[36px] bg-lift/50 hover:bg-line/50"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
