import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import './gamification.css'

// Same five milestones the backend uses in routers/gamification.py.
const MILESTONES = [
  [100, 'Getting Started'],
  [200, 'Novice Learner'],
  [500, 'Rising Star'],
  [1000, 'SkillVerse Expert'],
  [5000, 'SkillVerse Legend'],
]

const AV_FILLS = ['#D6F3EA', '#FBEFC4', '#E6DDF6', '#FFE3CF', '#D2BEA0']
const avFill = (name = '') => AV_FILLS[(name.charCodeAt(0) || 0) % AV_FILLS.length]
const PODIUM_FILL = ['#FBEFC4', '#F0E5D2', '#FFE3CF']
const PODIUM_HEIGHT = [120, 90, 70]

export default function Gamification() {
  const me = getSessionUser()
  const [leaderboard, setLeaderboard] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const timer = setTimeout(() => { if (isMounted) setShowLoading(true) }, 150)
    Promise.all([
      api.getLeaderboard().then(data => { if (isMounted) setLeaderboard(data || []) }).catch(() => {}),
      api.getGamificationSummary().then(data => { if (isMounted) setSummary(data) }).catch(() => {}),
    ]).finally(() => {
      if (isMounted) { clearTimeout(timer); setLoading(false); setShowLoading(false) }
    })
    return () => { isMounted = false; clearTimeout(timer) }
  }, [])

  if (loading && showLoading) {
    return (
      <div className="sv-journey">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div className="sk" style={{ height: 110 }} />
          <div className="sk" style={{ height: 260 }} />
          <div className="grid2"><div className="sk" style={{ height: 320 }} /><div className="sk" style={{ height: 320 }} /></div>
        </div>
      </div>
    )
  }

  const xp = summary?.total_points ?? 0
  const rank = summary?.current_rank ?? null
  const achievements = summary?.achievements ?? []
  const earnedCount = achievements.filter(a => a.earned).length

  // Which milestone are we working towards, and where did the previous one end?
  let nextIdx = MILESTONES.findIndex(([pts]) => xp < pts)
  if (nextIdx === -1) nextIdx = null
  const prevPts = nextIdx == null ? 0 : (nextIdx > 0 ? MILESTONES[nextIdx - 1][0] : 0)
  const nextText = summary?.next_milestone_points && summary?.next_milestone_title
    ? `${Math.max(0, summary.next_milestone_points - xp)} XP to ${summary.next_milestone_title}`
    : 'Top level reached'

  const podium = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  // Design order puts 2nd, 1st, 3rd across so the winner stands in the middle.
  const podiumOrder = podium.length === 3 ? [1, 0, 2] : podium.map((_, i) => i)

  return (
    <div className="sv-journey">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 30 }}>

        <Link to="/dashboard" style={{ fontWeight: 800, fontSize: 14, alignSelf: 'flex-start' }}>← Back to Dashboard</Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eb">SKILL JOURNEY</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px, 4.6vw, 52px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>
            Earn XP by sharing what you know
          </h1>
        </div>

        {/* ---- level ladder ---- */}
        <section className="card" aria-labelledby="sv-lv" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22, background: '#29251F', color: '#FFFDF8', backgroundImage: 'radial-gradient(#4A443A 1.6px, transparent 1.6px)', backgroundSize: '26px 26px', boxShadow: '0 4px 0 var(--accd), 0 7px 0 #29251F' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span id="sv-lv" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#D9CBB2' }}>YOUR STANDING</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <span className="mono" style={{ fontSize: 64, lineHeight: .9 }}>{xp}</span>
                <span style={{ fontWeight: 900, fontSize: 18, paddingBottom: 6 }}>XP</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {rank != null && <span className="pill" style={{ height: 36, fontSize: 14, background: 'var(--acc)' }}>Rank #{rank}</span>}
              <span className="pill" style={{ height: 36, fontSize: 14, background: 'transparent', color: '#FFFDF8', borderColor: '#FFFDF8' }}>{nextText}</span>
            </div>
          </div>

          <ol className="ladder" aria-label="Level milestones" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, alignItems: 'end' }}>
            {MILESTONES.map(([pts, title], i) => {
              const done = xp >= pts
              const here = nextIdx === i
              const pct = here ? Math.max(0, Math.min(100, Math.round(((xp - prevPts) / (pts - prevPts)) * 100))) : 0
              return (
                <li
                  key={pts}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 12,
                    border: `2px ${done || here ? 'solid' : 'dashed'} ${done || here ? '#FFFDF8' : '#6E6455'}`,
                    minHeight: 60 + i * 18, justifyContent: 'flex-end',
                    ...(done
                      ? { background: '#D6F3EA', color: '#29251F' }
                      : here
                        ? { background: 'var(--acc)', color: '#29251F', boxShadow: '0 4px 0 #FFFDF8' }
                        : { color: '#B9AE9C' }),
                  }}
                >
                  <span className="mono" style={{ fontSize: 13 }}>{pts} XP</span>
                  <strong style={{ fontSize: 14, lineHeight: 1.2 }}>{title}</strong>
                  {here && (
                    <>
                      <span style={{ height: 10, border: '2px solid #29251F', borderRadius: 999, background: '#FFFDF8', overflow: 'hidden', marginTop: 4 }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--acc)' }} />
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800 }}>{pts - xp} to go</span>
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        {/* ---- ways to earn ---- */}
        <section aria-labelledby="sv-we" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 id="sv-we" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Ways to earn XP</h2>
          <div className="earn" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              ['+50', 'var(--acc)', 'Earn your first badge in a skill in the Skill Arena'],
              ['+20', '#D6F3EA', 'Mark a connection complete — both partners earn it'],
              ['+5', '#FBEFC4', 'Leave a review after a session'],
            ].map(([amt, bg, text]) => (
              <div key={amt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '2px solid #29251F', borderRadius: 14, background: '#FFFDF8' }}>
                <span className="mono" style={{ padding: '6px 10px', border: '2px solid #29251F', borderRadius: 10, background: bg, fontSize: 18 }}>{amt}</span>
                <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid2">
          {/* ---- achievements ---- */}
          <section className="card" aria-labelledby="sv-ac" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="sv-ac" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Achievements</h2>
              <span className="pill mono" style={{ background: 'var(--accl)' }}>{earnedCount} / {achievements.length || 6}</span>
            </div>
            <div className="achg" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {achievements.map(a => (
                <div key={a.id} className={`ach${a.earned ? '' : ' lock'}`}>
                  <span className="ic" style={a.earned ? { background: 'var(--accl)' } : { background: '#F0E5D2', borderStyle: 'dashed' }}>
                    {a.earned ? (a.icon || '★') : '🔒'}
                  </span>
                  <strong style={{ fontSize: 15 }}>{a.title}</strong>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{a.description}</span>
                  <span className="mono" style={{ fontSize: 11 }}>
                    {a.earned
                      ? (a.earned_at ? `Earned ${new Date(a.earned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Earned')
                      : 'Locked'}
                  </span>
                </div>
              ))}
              {achievements.length === 0 && (
                <span className="muted" style={{ gridColumn: 'span 2', fontSize: 14 }}>Achievements will appear here as you earn them.</span>
              )}
            </div>
          </section>

          {/* ---- leaderboard ---- */}
          <section className="card" aria-labelledby="sv-lb" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '2px solid #29251F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0E5D2' }}>
              <h2 id="sv-lb" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Top learners &amp; tutors</h2>
              <span className="pill">{leaderboard.length} users</span>
            </div>

            {podium.length > 0 && (
              <div className="pod" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 14, padding: '24px 16px 0', borderBottom: '2px solid #29251F', background: '#FFFDF8' }}>
                {podiumOrder.map(idx => {
                  const u = podium[idx]
                  if (!u) return null
                  const size = idx === 0 ? 56 : 46
                  return (
                    <div key={u.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 120 }}>
                      <span className="av" style={{ background: avFill(u.name), width: size, height: size, fontSize: Math.round(size / 2.6) }}>
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <strong style={{ fontSize: 13, textAlign: 'center' }}>{u.name}</strong>
                      <span className="mono" style={{ fontSize: 12 }}>{u.points} XP</span>
                      <div style={{ width: '100%', height: PODIUM_HEIGHT[idx], border: '2px solid #29251F', borderBottom: 'none', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, background: PODIUM_FILL[idx] }}>
                        <span className="mono" style={{ fontSize: 26 }}>{idx + 1}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <ol style={{ listStyle: 'none', margin: 0, padding: '0 0 8px', maxHeight: 360, overflowY: 'auto' }}>
              {rest.map(u => {
                const isMe = me && u.user_id === me.id
                return (
                  <li key={u.user_id} className={`row${isMe ? ' me' : ''}`}>
                    <span className="mono" style={{ width: 32, textAlign: 'center', fontSize: 14 }}>{u.rank}</span>
                    <span className="av" style={{ background: avFill(u.name) }}>{(u.name || '?').charAt(0).toUpperCase()}</span>
                    <strong style={{ flex: 1, fontSize: 15 }}>
                      {u.name}
                      {isMe && <span className="pill" style={{ marginLeft: 8, height: 22, fontSize: 10, background: '#29251F', color: '#FFFDF8' }}>YOU</span>}
                    </strong>
                    <span className="mono" style={{ fontSize: 16 }}>{u.points} <span style={{ fontSize: 11, color: '#6E6455' }}>XP</span></span>
                  </li>
                )
              })}
              {leaderboard.length === 0 && (
                <li style={{ padding: 24 }}><span className="muted">The leaderboard fills up as people earn XP.</span></li>
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
