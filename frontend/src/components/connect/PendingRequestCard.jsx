import React, { useState } from 'react'

export default function PendingRequestCard({ req, onAccept, onDecline }) {
  const [submitting, setSubmitting] = useState(false)

  const handleAccept = async () => {
    setSubmitting(true)
    await onAccept(req.id)
    setSubmitting(false)
  }

  const handleDecline = async () => {
    setSubmitting(true)
    await onDecline(req.id)
    setSubmitting(false)
  }

  return (
    <div className="p-4 border-b border-line/40 bg-brand/5 relative overflow-hidden">
      {/* Decorative indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand"></div>
      
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-display font-bold text-sm shrink-0 border border-brand/20">
          {req.from_user_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">
            {req.from_user_name}
          </p>
          <p className="text-xs text-clay truncate mt-0.5">
            Wants to learn <span className="font-medium text-ink">{req.skill_name}</span>
          </p>
          
          {req.message && (
            <div className="mt-2 text-xs text-ink/70 italic line-clamp-2 bg-lift p-2 rounded-lg border border-line/50">
              "{req.message}"
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-3">
            <button 
              onClick={handleAccept} 
              disabled={submitting}
              className="flex-1 py-1.5 px-3 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brandLight transition-all shadow-sm disabled:opacity-50"
            >
              Accept
            </button>
            <button 
              onClick={handleDecline}
              disabled={submitting} 
              className="flex-1 py-1.5 px-3 bg-lift text-ink text-xs font-semibold rounded-lg hover:bg-line/50 border border-line transition-colors disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
