import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import './exchanges.css'

const LEG_STATUS = {
  pending: ['● Pending', { background: '#FBEFC4' }, '#F5C542'],
  active: ['● Active', { background: '#D6F3EA' }, '#6CCFB0'],
  delivered: ['✓ Delivered', { background: '#FFFDF8' }, '#29251F'],
  completed: ['✓ Delivered', { background: '#FFFDF8' }, '#29251F'],
}

const GROUP_STATUS = {
  proposed: ['● Proposed', { background: '#FBEFC4' }],
  active: ['● Active Circle', { background: '#D6F3EA' }],
  completed: ['✓ Completed', { background: '#FFFDF8' }],
  cancelled: ['○ Cancelled', { background: '#F0E5D2', color: '#6E6455' }],
}

export default function Exchanges() {
  const user = getSessionUser()
  const [tab, setTab] = useState('proposed') // 'proposed', 'active', 'completed'
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadExchanges()
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 5000)
  }

  async function loadExchanges() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getMyExchanges()
      setGroups(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load exchange circles')
    } finally {
      setLoading(false)
    }
  }

  async function handleRespond(groupId, accept) {
    if (actionLoadingId !== null) return
    setActionLoadingId(groupId)
    try {
      await api.respondToExchangeGroup(groupId, accept)
      showToast(accept ? 'Accepted circle proposal!' : 'Declined circle proposal')
      await loadExchanges()
    } catch (err) {
      showToast(err.message || 'Action failed')
    } finally {
      setActionLoadingId(null)
    }
  }

  const categorized = useMemo(() => {
    const proposed = []
    const active = []
    const completed = []

    groups.forEach(g => {
      if (g.status === 'proposed') proposed.push(g)
      else if (g.status === 'active') active.push(g)
      else if (g.status === 'completed' || g.status === 'cancelled') completed.push(g)
    })

    return { proposed, active, completed }
  }, [groups])

  const currentList = categorized[tab] || []

  return (
    <div className="sv-ex">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '44px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Header */}
        <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
            <span className="eb">SKILL CIRCLES</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-1.2px', lineHeight: 1.05 }}>
              Exchanges
            </h1>
            <p className="muted" style={{ margin: 0, fontSize: 17 }}>
              Track 3-way circular skill loops. Every member teaches one peer and learns from another.
            </p>
          </div>

          <Link to="/marketplace" className="btn btn-s">
            Explore Marketplace →
          </Link>
        </section>

        {error && (
          <div className="card" style={{ padding: '14px 18px', background: '#F6DDD8', borderColor: '#9A2B1E', color: '#9A2B1E', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="tabs-wrap" style={{ display: 'flex', borderBottom: '2px solid #29251F' }}>
            {[
              ['proposed', 'Proposed', categorized.proposed.length],
              ['active', 'Active', categorized.active.length],
              ['completed', 'Completed', categorized.completed.length]
            ].map(([k, label, count]) => (
              <button
                key={k}
                type="button"
                className={`tab${tab === k ? ' on' : ''}`}
                onClick={() => setTab(k)}
              >
                {label}
                {count > 0 && <span className="cnt">{count}</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 28 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="sk" style={{ height: 200 }} />
                <div className="sk" style={{ height: 200 }} />
              </div>
            ) : currentList.length === 0 ? (
              <div className="card" style={{ padding: '52px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
                <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#FBEFC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 4px 0 #29251F' }}>
                  🔄
                </span>
                <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900 }}>
                  No {tab} exchanges
                </h2>
                <p className="muted" style={{ margin: 0, fontSize: 16, maxWidth: 500 }}>
                  {tab === 'proposed'
                    ? 'When you or another member proposes a 3-way circle, it will appear here for responses.'
                    : tab === 'active'
                    ? 'Accepted circular exchanges will appear here with links to each session or connection.'
                    : 'Delivered or closed exchanges will be archived here.'}
                </p>
                {tab === 'proposed' && (
                  <Link to="/marketplace" className="btn btn-p" style={{ marginTop: 8 }}>
                    Find Circle Suggestions
                  </Link>
                )}
              </div>
            ) : (
              currentList.map(grp => (
                <ExchangeGroupCard
                  key={grp.id}
                  grp={grp}
                  currentUserId={user?.id}
                  onRespond={handleRespond}
                  isResponding={actionLoadingId === grp.id}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div role="status" style={{ position: 'fixed', right: 24, bottom: 24, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: '2px solid #29251F', borderRadius: 14, background: '#D6F3EA', boxShadow: '0 4px 0 #29251F', fontWeight: 700, zIndex: 10, maxWidth: 380 }}>
          <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 999, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</span>
          {toast}
          <button type="button" aria-label="Dismiss" onClick={() => setToast('')} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}

function ExchangeGroupCard({ grp, currentUserId, onRespond, isResponding }) {
  const members = grp.members || []
  const legs = grp.legs || []

  // Check if current user has accepted
  const myMember = members.find(m => m.user_id === currentUserId)
  const hasUserResponded = myMember ? myMember.accepted : false

  const groupBadge = GROUP_STATUS[grp.status] || GROUP_STATUS.proposed

  return (
    <article className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Group Header */}
      <div className="group-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 0 #29251F' }}>
            🔄
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
                Circle #{grp.id}
              </h3>
              <span className="pill" style={groupBadge[1]}>
                {groupBadge[0]}
              </span>
            </div>
            <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
              {members.length} participants · 3-way circular exchange
            </span>
          </div>
        </div>

        {/* Proposed status: Accept / Decline buttons if user hasn't accepted yet */}
        {grp.status === 'proposed' && myMember && !hasUserResponded && (
          <div className="acts" style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-p"
              disabled={isResponding}
              onClick={() => onRespond(grp.id, true)}
            >
              {isResponding ? 'Responding…' : 'Accept Circle'}
            </button>
            <button
              type="button"
              className="btn btn-d"
              disabled={isResponding}
              onClick={() => onRespond(grp.id, false)}
            >
              Decline
            </button>
          </div>
        )}
      </div>

      {/* Members Acceptances Progress (for proposed groups) */}
      {grp.status === 'proposed' && (
        <div style={{ padding: '12px 16px', border: '2px solid #29251F', borderRadius: 12, background: '#FBEFC4', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eb" style={{ color: '#29251F' }}>ACCEPTED SO FAR</span>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {members.map(m => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: '2px solid #29251F',
                    background: m.accepted ? '#6CCFB0' : '#E2D3BB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#29251F'
                  }}
                >
                  {m.accepted ? '✓' : '◷'}
                </span>
                <span>{m.user_id === currentUserId ? 'You' : m.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {m.accepted ? '(Accepted)' : '(Pending response)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="eb">EXCHANGE LEGS</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
          {legs.map((leg, lIdx) => {
            const legBadge = LEG_STATUS[leg.status] || LEG_STATUS.pending
            const involvesMe = leg.teacher_id === currentUserId || leg.learner_id === currentUserId
            const amTeacher = leg.teacher_id === currentUserId

            return (
              <div
                key={leg.id || lIdx}
                style={{
                  padding: 16,
                  border: '2px solid #29251F',
                  borderRadius: 12,
                  background: involvesMe ? '#FFFDF8' : '#F9F5ED',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: involvesMe ? '0 3px 0 #29251F' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span className="pill" style={{ ...legBadge[1], height: 24, fontSize: 11 }}>
                    {legBadge[0]}
                  </span>
                  {involvesMe && (
                    <span className="pill" style={{ background: '#D6F3EA', height: 24, fontSize: 11 }}>
                      {amTeacher ? 'You teach' : 'You learn'}
                    </span>
                  )}
                </div>

                {/* Leg phrase: "Name teaches Skill to Name" */}
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.45, color: '#29251F' }}>
                  <span>{leg.teacher_id === currentUserId ? 'You' : leg.teacher_name}</span>
                  <span style={{ fontWeight: 600, color: '#6E6455' }}> teaches </span>
                  <span style={{ padding: '2px 6px', border: '1.5px solid #29251F', borderRadius: 6, background: 'var(--accl)' }}>
                    {leg.skill_name}
                  </span>
                  <span style={{ fontWeight: 600, color: '#6E6455' }}> to </span>
                  <span>{leg.learner_id === currentUserId ? 'You' : leg.learner_name}</span>
                </div>

                {/* If active and involves me, show action button to request or session screen */}
                {grp.status === 'active' && involvesMe && (
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    {leg.request_id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link
                          to={`/messages?request_id=${leg.request_id}`}
                          className="btn btn-p"
                          style={{ flex: 1, minHeight: 38, fontSize: 13 }}
                        >
                          Chat / Plan
                        </Link>
                        <Link
                          to="/sessions"
                          className="btn btn-s"
                          style={{ flex: 1, minHeight: 38, fontSize: 13 }}
                        >
                          Sessions
                        </Link>
                      </div>
                    ) : (
                      <Link
                        to="/requests"
                        className="btn btn-s"
                        style={{ width: '100%', minHeight: 38, fontSize: 13 }}
                      >
                        View Request
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}
