import React from 'react'
import { formatDateTime } from '../../utils/dateTime'

export default function SessionCard({ conv, onCancel, navigate }) {
  if (!conv?.session_id) return null
  const dateStr = conv.scheduled_start
    ? formatDateTime(conv.scheduled_start)
    : `${conv.session_date || ''} ${conv.session_time || ''}`.trim()

  return (
    <div style={{
      margin: '14px 16px 0', padding: '14px 16px',
      border: '2px solid #29251F', borderTop: '8px solid var(--acc)',
      borderRadius: 14, background: '#FFFDF8', boxShadow: '0 3px 0 #29251F',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16, textTransform: 'capitalize' }}>Learning {conv.skill_name}</strong>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', border: '2px solid #29251F', borderRadius: 999, background: '#D6F3EA', letterSpacing: '.05em' }}>SCHEDULED</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
          With {conv.other_user_name} • <span className="mono">{dateStr}</span>
        </div>
      </div>
      <button type="button" className="btn btn-s" style={{ color: '#9A2B1E' }} onClick={() => onCancel(conv.session_id)}>Cancel</button>
      <button type="button" className="btn btn-p" onClick={() => navigate(`/session/${conv.session_id}`)}>▶ Join</button>
    </div>
  )
}
