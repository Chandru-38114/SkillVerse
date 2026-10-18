import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import './requests.css'

const AV_BG = ['#FBEFC4', '#E6DDF6', '#D6F3EA', '#FFE3CF']

const ST = {
  pending: ['● Pending', { background: '#FBEFC4' }, '#F5C542'],
  accepted: ['● Accepted', { background: '#D6F3EA' }, '#6CCFB0'],
  declined: ['○ Declined', { background: '#F0E5D2', color: '#6E6455', borderColor: '#8C8273' }, '#D2BEA0'],
  completed: ['✓ Completed', { background: '#FFFDF8' }, '#29251F'],
}

export default function Requests() {
  const [tab, setTab] = useState('incoming')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewedMap, setReviewedMap] = useState({})
  const [confirmReq, setConfirmReq] = useState(null)
  const [completing, setCompleting] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [inc, out] = await Promise.all([api.incomingRequests(), api.outgoingRequests()])
      setIncoming(inc)
      setOutgoing(out)

      const completed = [...inc, ...out].filter((r) => r.status === 'completed')

      let sessions = []
      try {
        sessions = await api.mySessions()
      } catch (e) {
        console.error("Failed to fetch sessions", e)
      }

      const completedSessionsToReview = []
      completed.forEach((r) => {
        const reqSessions = sessions.filter(s => s.request_id === r.id && s.status === 'completed')
        reqSessions.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))
        if (reqSessions.length > 0) {
          completedSessionsToReview.push({ r, s: reqSessions[0] })
        }
      })

      const checks = await Promise.allSettled(
        completedSessionsToReview.map((item) => api.getMyReviewForSession(item.s.id))
      )

      const map = {}
      completedSessionsToReview.forEach((item, i) => {
        if (checks[i].status === 'fulfilled' && checks[i].value) {
          map[item.r.id] = { reviewed: true, sessionId: item.s.id }
        } else {
          map[item.r.id] = { reviewed: false, sessionId: item.s.id }
        }
      })
      setReviewedMap(map)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Ignore extra clicks while a response is in flight (a second call now gets
  // "already accepted" from the server and showed a false error).
  const respondingRef = useRef(null)
  async function respond(id, accept) {
    if (respondingRef.current) return
    respondingRef.current = id
    setError('')
    try {
      await api.respondToRequest(id, accept)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      respondingRef.current = null
    }
  }

  async function completeSession(id) {
    setError('')
    setCompleting(true)
    try {
      await api.completeRequest(id)
      setConfirmReq(null)
      load()
    } catch (err) {
      setError(err.message)
      setConfirmReq(null)
    } finally {
      setCompleting(false)
    }
  }

  function markReviewed(requestId) {
    setReviewedMap((m) => ({ ...m, [requestId]: { ...m[requestId], reviewed: true } }))
  }

  const list = tab === 'incoming' ? incoming : outgoing
  const all = [...incoming, ...outgoing]
  const incomingPending = incoming.filter((r) => r.status === 'pending').length
  const activeCount = all.filter((r) => r.status === 'accepted').length
  const completedCount = all.filter((r) => r.status === 'completed').length

  const empty = tab === 'incoming'
    ? { icon: '📬', title: 'No incoming requests', text: 'When someone wants to learn from you, their request will appear here.' }
    : { icon: '📤', title: 'No sent requests', text: 'Find a teacher in the marketplace and send your first request.' }

  return (
    <div className="sv-req">
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '44px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="eb">MY CONNECTIONS</span>
            <h1 style={{ margin: 0, fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>Requests</h1>
          </div>
          <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 10 }}>
            <div style={{ padding: '10px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#FBEFC4', boxShadow: '0 3px 0 #29251F' }}>
              <div className="mono" style={{ fontSize: 22 }}>{incomingPending}</div>
              <span style={{ fontSize: 12, fontWeight: 800 }}>to answer</span>
            </div>
            <div style={{ padding: '10px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA', boxShadow: '0 3px 0 #29251F' }}>
              <div className="mono" style={{ fontSize: 22 }}>{activeCount}</div>
              <span style={{ fontSize: 12, fontWeight: 800 }}>active</span>
            </div>
            <div style={{ padding: '10px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#FFFDF8', boxShadow: '0 3px 0 #29251F' }}>
              <div className="mono" style={{ fontSize: 22 }}>{completedCount}</div>
              <span style={{ fontSize: 12, fontWeight: 800 }}>completed</span>
            </div>
          </div>
        </div>

        {/* tabs */}
        <div>
          <div role="tablist" style={{ display: 'flex', gap: 8, paddingLeft: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'incoming'} className={`tab${tab === 'incoming' ? ' on' : ''}`} onClick={() => setTab('incoming')}>
              Incoming
              {incomingPending > 0 && <span className="cnt" aria-label={`${incomingPending} pending`}>{incomingPending}</span>}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'outgoing'} className={`tab${tab === 'outgoing' ? ' on' : ''}`} onClick={() => setTab('outgoing')}>
              Sent
            </button>
          </div>

          <div style={{ borderTop: '2px solid #29251F', paddingTop: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {error && (
              <div className="card" style={{ padding: '14px 18px', background: '#F6DDD8', borderColor: '#9A2B1E', color: '#9A2B1E', fontWeight: 700 }}>{error}</div>
            )}

            {loading ? (
              <>
                <div className="sk" style={{ height: 180 }} />
                <div className="sk" style={{ height: 180 }} />
                <div className="sk" style={{ height: 180 }} />
              </>
            ) : list.length === 0 ? (
              <div className="card" style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
                <span style={{ width: 80, height: 80, borderRadius: 22, border: '2px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, transform: 'rotate(-5deg)', boxShadow: '0 5px 0 #29251F' }}>{empty.icon}</span>
                <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900 }}>{empty.title}</h2>
                <p className="muted" style={{ margin: 0, maxWidth: 380, fontSize: 15, lineHeight: 1.55 }}>{empty.text}</p>
                {tab === 'outgoing' && (
                  <Link to="/marketplace" className="btn btn-p" style={{ marginTop: 6, minHeight: 50 }}>Browse teachers →</Link>
                )}
              </div>
            ) : (
              list.map((r, idx) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  idx={idx}
                  tab={tab}
                  onAccept={() => respond(r.id, true)}
                  onDecline={() => respond(r.id, false)}
                  onComplete={() => setConfirmReq(r)}
                  reviewed={reviewedMap[r.id]}
                  onReviewed={() => markReviewed(r.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* mark-complete confirm */}
      {confirmReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(41,37,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 }}>
          <div className="card" role="dialog" aria-labelledby="sv-req-mc" style={{ maxWidth: 440, width: '100%', padding: 30, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#D6F3EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, boxShadow: '0 5px 0 #29251F' }}>✓</span>
            <h3 id="sv-req-mc" style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Mark this as complete?</h3>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
              You and {((tab === 'incoming' ? confirmReq.from_user_name : confirmReq.to_user_name) || 'they').split(' ')[0]} both earn <strong style={{ color: '#29251F' }}>+20 pts</strong>. The connection moves to Completed and you can leave a review. This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button type="button" className="btn btn-s" style={{ flex: 1, minHeight: 50 }} onClick={() => setConfirmReq(null)}>Not yet</button>
              <button type="button" className="btn btn-p" style={{ flex: 1, minHeight: 50 }} disabled={completing} onClick={() => completeSession(confirmReq.id)}>
                {completing ? 'Working…' : 'Yes, complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ r, idx, tab, onAccept, onDecline, onComplete, reviewed, onReviewed }) {
  const otherName = tab === 'incoming' ? r.from_user_name : r.to_user_name
  const s = ST[r.status] || ST.pending
  const inc = tab === 'incoming'

  const hasLearnInfo = r.learner_current_level || r.learner_topics || r.learner_goals
  const hasTeachInfo = r.learner_can_teach || r.learner_teach_proficiency

  const cardStyle = {
    borderLeftWidth: 10,
    borderLeftColor: s[2],
    ...(r.status === 'declined' ? { opacity: .8 } : {}),
  }

  return (
    <article className="card" style={cardStyle}>
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{
            width: 52, height: 52, flex: 'none', borderRadius: 999, border: '2px solid #29251F',
            background: AV_BG[idx % AV_BG.length], display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, fontWeight: 900, boxShadow: '0 3px 0 #29251F'
          }}>{(otherName || '?')[0]}</span>

          <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 19 }}>{otherName}</strong>
              <span className="pill" style={s[1]}>{s[0]}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {inc ? 'wants to learn' : 'You asked to learn'}{' '}
              <span style={{ padding: '2px 8px', border: '2px solid #29251F', borderRadius: 6, background: 'var(--accl)' }}>{r.skill_name}</span>
            </span>
          </div>

          <div className="acts" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {inc && r.status === 'pending' && (
              <>
                <button type="button" className="btn btn-p" onClick={onAccept}>Accept</button>
                <button type="button" className="btn btn-s" onClick={onDecline}>Decline</button>
              </>
            )}
            {r.status === 'accepted' && (
              <>
                <Link to={`/messages?request_id=${r.id}`} className="btn btn-p">Open chat</Link>
                <button type="button" className="btn btn-g" title="Both participants earn +20 pts" onClick={onComplete}>Mark complete ✓</button>
              </>
            )}
            {!inc && r.status === 'pending' && (
              <span className="muted" style={{ fontSize: 13, fontWeight: 700, paddingTop: 12 }}>Waiting for their reply</span>
            )}
            {r.status === 'declined' && (
              <span className="muted" style={{ fontSize: 13, fontWeight: 700, paddingTop: 12 }}>No further action</span>
            )}
          </div>
        </div>

        {r.message && (
          <div style={{ position: 'relative', alignSelf: 'flex-start', maxWidth: 600, padding: '12px 16px', border: '2px solid #29251F', borderRadius: '4px 14px 14px 14px', background: '#F8F3E9', fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
            {r.message}
          </div>
        )}

        {(hasLearnInfo || hasTeachInfo) && (
          <div className="ctx" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {hasLearnInfo && (
              <div style={{ padding: 14, border: '2px solid #29251F', borderRadius: 12, background: '#E6DDF6', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="eb" style={{ color: '#29251F' }}>{inc ? 'THEY WANT TO LEARN' : 'YOU WANT TO LEARN'}</span>
                <dl className="kv" style={{ margin: 0 }}>
                  {r.learner_current_level && (<><dt>Current level</dt><dd>{r.learner_current_level}</dd></>)}
                  {r.learner_topics && (<><dt>Topics</dt><dd>{r.learner_topics}</dd></>)}
                  {r.learner_goals && (<><dt>Goals</dt><dd>{r.learner_goals}</dd></>)}
                </dl>
              </div>
            )}
            {hasTeachInfo && (
              <div style={{ padding: 14, border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="eb" style={{ color: '#29251F' }}>{inc ? 'THEY CAN TEACH' : 'YOU OFFERED TO TEACH'}</span>
                <dl className="kv" style={{ margin: 0 }}>
                  {r.learner_can_teach && (<><dt>Skills</dt><dd>{r.learner_can_teach}</dd></>)}
                  {r.learner_teach_proficiency && (<><dt>Proficiency</dt><dd>{r.learner_teach_proficiency}</dd></>)}
                </dl>
              </div>
            )}
          </div>
        )}

        {r.status === 'accepted' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '2px dashed #29251F', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
            <span aria-hidden="true">💬</span>Use <strong>Connect</strong> to chat and schedule a session with this person.
          </div>
        )}

        {r.status === 'completed' && reviewed && (
          reviewed.reviewed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA', fontWeight: 700, alignSelf: 'flex-start' }}>
              <span style={{ width: 26, height: 26, borderRadius: 999, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</span>
              Review submitted — thanks for the feedback!
            </div>
          ) : (
            <ReviewPanel sessionId={reviewed.sessionId} otherName={otherName} onSubmitted={onReviewed} />
          )
        )}
      </div>
    </article>
  )
}

// ── Inline review form ────────────────────────────────────────────────────────

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

function ReviewPanel({ sessionId, otherName, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const shown = hovered || rating

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating === 0) { setFormError('Please select a star rating.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      await api.submitReview(sessionId, { rating, comment })
      onSubmitted()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, border: '2px solid #29251F', borderRadius: 12, background: '#FBEFC4', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontWeight: 700 }}>Rate your session with <strong>{otherName}</strong></span>

      <div role="group" aria-label="Rating" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star${star <= shown ? ' on' : ''}`}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
          >★</button>
        ))}
        {shown > 0 && <span style={{ marginLeft: 8, fontWeight: 800 }}>{RATING_WORDS[shown]}</span>}
      </div>

      <textarea
        className="in"
        rows="2"
        placeholder="Share what made this session valuable (optional)…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
      />

      {formError && <span style={{ fontSize: 13, fontWeight: 700, color: '#9A2B1E' }}>{formError}</span>}

      <button type="submit" className="btn btn-p" style={{ alignSelf: 'flex-start' }} disabled={submitting || rating === 0}>
        {submitting ? 'Submitting…' : 'Submit review (+5 pts)'}
      </button>
    </form>
  )
}
