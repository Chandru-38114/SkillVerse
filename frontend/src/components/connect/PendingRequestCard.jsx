import React, { useState } from 'react'

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
    <div style={{
      padding: 12,
      border: '2px solid #29251F', borderLeftWidth: 8, borderLeftColor: '#F5C542',
      borderRadius: 14, background: '#FBEFC4',
      display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="av" style={{ width: 40, height: 40, fontSize: 16, background: req.from_user_avatar ? `#FFFDF8 url(${req.from_user_avatar}) center / cover no-repeat` : '#E6DDF6' }}>
          {req.from_user_avatar ? '' : (req.from_user_name || '?')[0]}
        </span>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 14 }}>{req.from_user_name}</strong>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            Wants to learn <strong>{req.skill_name}</strong>
          </div>
        </div>
      </div>

      {req.message && (
        <div style={{ fontSize: 13, fontWeight: 600, padding: '8px 10px', border: '2px solid #29251F', borderRadius: '4px 10px 10px 10px', background: '#FFFDF8' }}>
          {req.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-p"
          style={{ flex: 1, minHeight: 36, fontSize: 13, padding: '0 10px' }}
          disabled={submitting}
          onClick={handleAccept}
        >
          Accept
        </button>
        <button
          type="button"
          className="btn btn-s"
          style={{ flex: 1, minHeight: 36, fontSize: 13, padding: '0 10px' }}
          disabled={submitting}
          onClick={handleDecline}
        >
          Decline
        </button>
      </div>
    </div>
  )
}
