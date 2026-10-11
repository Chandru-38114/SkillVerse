import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import './dashboard.css'

const STAGE_PILL = {
  'Discovered':           { background: '#EDE6D8' },
  'Baseline Established': { background: '#FFE3CF' },
  'Practicing':           { background: '#D6F3EA' },
  'Developing':           { background: '#E6DDF6' },
  'Mastery':              { background: '#FBEFC4' },
}

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
)

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getSessionUser()

  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)
  const [skills, setSkills] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [gamification, setGamification] = useState(null)
  const [weakTopic, setWeakTopic] = useState(null)
  const [outRequests, setOutRequests] = useState([])

  useEffect(() => {
    if (!user) { navigate('/login'); return }

    const searchParams = new URLSearchParams(location.search)
    const topic = searchParams.get('weakTopic')
    if (topic) setWeakTopic(topic)

    let isMounted = true
    const loadingTimer = setTimeout(() => { if (isMounted) setShowLoading(true) }, 150)

    async function fetchDashboardData() {
      try {
        const [skillsData, upcomingData, gamiData, outReqData, latestAssessmentData] = await Promise.all([
          api.getMyProgress().catch(() => []),
          api.upcomingSessions().catch(() => []),
          api.getGamificationSummary().catch(() => null),
          api.outgoingRequests().catch(() => []),
          api.getLatestAssessment().catch(() => null)
        ])
        if (!isMounted) return
        setSkills(skillsData || [])
        setUpcoming(upcomingData || [])
        setGamification(gamiData)
        setOutRequests(outReqData || [])
        if (!topic && latestAssessmentData?.weak_topics) {
          const arr = latestAssessmentData.weak_topics.split(',').map(t => t.trim()).filter(Boolean)
          if (arr.length > 0) setWeakTopic(arr[0])
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        if (isMounted) { clearTimeout(loadingTimer); setLoading(false); setShowLoading(false) }
      }
    }
    fetchDashboardData()
    return () => { isMounted = false; clearTimeout(loadingTimer) }
  }, [user?.id, navigate, location.search])

  if (!user) return null

  const learningSkills = skills.filter(s => s.role === 'learning')
  const nextSession = upcoming.length > 0 ? upcoming[0] : null
  const activeLearningSkill = learningSkills.length > 0
    ? learningSkills.reduce((prev, cur) => (prev.progress_percentage > cur.progress_percentage) ? prev : cur)
    : null

  let heroState = {
    title: 'Begin Your Journey',
    description: 'Take your first Skill Challenge to establish your baseline and unlock your path.',
    actionText: 'Start a Skill Challenge',
    actionUrl: '/assessment'
  }

  if (nextSession) {
    heroState = {
      title: 'Enter the Learning Arena',
      description: 'Your upcoming session is confirmed. Prepare to learn and practice.',
      actionText: 'Join Arena',
      actionUrl: `/session/${nextSession.id}`
    }
  } else if (weakTopic) {
    heroState = {
      title: 'Conquer Your Weak Topics',
      description: `Your recent challenge revealed an area for growth. Focus your training on: ${weakTopic}.`,
      actionText: `Find a partner for ${weakTopic}`,
      actionUrl: `/marketplace?q=${encodeURIComponent(weakTopic)}`
    }
  } else if (activeLearningSkill) {
    if (activeLearningSkill.stage === 'Discovered') {
      heroState = {
        title: 'Take the Skill Challenge',
        description: `Assess your ${activeLearningSkill.skill_name} to establish your baseline and earn initial XP.`,
        actionText: 'Start Challenge',
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`
      }
    } else if (activeLearningSkill.stage === 'Baseline Established' || activeLearningSkill.stage === 'Practicing') {
      const relevantRequest = outRequests.find(r =>
        r.skill_name === activeLearningSkill.skill_name &&
        (r.status === 'pending' || r.status === 'accepted')
      )
      if (relevantRequest) {
        if (relevantRequest.status === 'pending') {
          heroState = {
            title: 'Connection Pending',
            description: `Your request to learn ${activeLearningSkill.skill_name} is awaiting response.`,
            actionText: 'View Requests',
            actionUrl: '/requests'
          }
        } else {
          heroState = {
            title: 'Prepare for Learning',
            description: 'Coordinate and schedule a session with your partner to continue your journey.',
            actionText: 'Message Partner',
            actionUrl: `/messages?request_id=${relevantRequest.id}`
          }
        }
      } else {
        heroState = {
          title: 'Train with a Partner',
          description: `Mastery requires practice. Schedule a session in ${activeLearningSkill.skill_name} to keep growing.`,
          actionText: 'Find a partner',
          actionUrl: '/marketplace'
        }
      }
    } else if (activeLearningSkill.stage === 'Developing') {
      heroState = {
        title: 'The Final Challenge Awaits',
        description: `You've completed the learning path for ${activeLearningSkill.skill_name}. Take the final challenge to earn your verified badge.`,
        actionText: 'Take Final Challenge',
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`
      }
    } else if (activeLearningSkill.stage === 'Mastery') {
      heroState = {
        title: 'Mastery Achieved',
        description: `You hold a verified badge in ${activeLearningSkill.skill_name}. You can now guide others or begin a new quest.`,
        actionText: 'Start New Quest',
        actionUrl: '/marketplace'
      }
    }
  }

  const isEmptyState = skills.length === 0 && upcoming.length === 0
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase().replace(/^(\w+)\s/, '$1 · ')

  const xp = gamification?.total_points ?? 0
  const nextPoints = gamification?.next_milestone_points ?? null
  const nextTitle = gamification?.next_milestone_title ?? null
  const xpPct = nextPoints ? Math.min(100, Math.round((xp / nextPoints) * 100)) : 100
  const badgedSkills = skills.filter(s => s.badge)

  const peerName = nextSession
    ? (nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name) || 'Your partner'
    : null

  if (loading && showLoading) {
    return (
      <div className="sv-dash">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0' }}>
          <div aria-busy="true" aria-label="Loading dashboard" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div className="sk" style={{ height: 340 }} />
            <div className="grid">
              <div className="sk" style={{ height: 280 }} />
              <div className="sk" style={{ height: 280 }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sv-dash">
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* ---- HERO ---- */}
        <section className="hero" aria-labelledby="sv-greet">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eb">{today}</span>
              <h1 id="sv-greet" style={{ margin: 0, fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1, fontWeight: 900, letterSpacing: '-1.4px' }}>
                {timeGreeting}, <span style={{ background: 'var(--acc)', padding: '0 10px', border: '2px solid #29251F', borderRadius: 12, display: 'inline-block', transform: 'rotate(-1.5deg)', boxShadow: '0 4px 0 #29251F' }}>{(user.name || 'there').split(' ')[0]}</span>.
              </h1>
            </div>

            <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
              <span className="pill" style={{ alignSelf: 'flex-start', background: 'var(--accl)' }}>★ YOUR NEXT STEP</span>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>{heroState.title}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 17, lineHeight: 1.55, maxWidth: 560 }}>{heroState.description}</p>
              <Link to={heroState.actionUrl} className="btn btn-p" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                {heroState.actionText} <Chevron />
              </Link>
            </div>
          </div>

          {/* XP / level panel */}
          <div className="card" style={{ padding: 28, background: '#29251F', color: '#FFFDF8', display: 'flex', flexDirection: 'column', gap: 20, backgroundImage: 'radial-gradient(#4A443A 1.6px, transparent 1.6px)', backgroundSize: '26px 26px', boxShadow: '0 4px 0 var(--accd), 0 7px 0 #29251F' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#D9CBB2' }}>YOUR LEVEL</span>
              <Link to="/gamification" style={{ color: '#FFFDF8', fontSize: 13, fontWeight: 800 }}>View journey →</Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <span style={{ font: "700 64px 'JetBrains Mono', monospace", lineHeight: .9 }}>{xp}</span>
              <span style={{ fontSize: 18, fontWeight: 800, paddingBottom: 6 }}>XP</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="bar" style={{ borderColor: '#FFFDF8', background: '#4A443A', height: 16 }}>
                <span style={{ width: `${xpPct}%`, borderRightColor: '#FFFDF8' }} />
              </div>
              <span style={{ fontSize: 14, color: '#D9CBB2' }}>
                {nextPoints && nextTitle
                  ? <><strong style={{ color: '#FFFDF8' }}>{Math.max(0, nextPoints - xp)} XP</strong> to <strong style={{ color: '#FFFDF8' }}>{nextTitle}</strong> ({nextPoints})</>
                  : <>You’ve reached the highest milestone.</>}
              </span>
            </div>
            <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 'auto' }}>
              {[
                { v: gamification?.current_rank != null ? `#${gamification.current_rank}` : '—', l: 'Rank' },
                { v: learningSkills.length, l: 'Learning' },
                { v: badgedSkills.length, l: 'Badges' },
              ].map((s, i) => (
                <div key={i} style={{ border: '2px solid #FFFDF8', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: "700 24px 'JetBrains Mono', monospace" }}>{s.v}</span>
                  <span style={{ fontSize: 12, color: '#D9CBB2', fontWeight: 700 }}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- EMPTY ---- */}
        {isEmptyState && (
          <div className="card" style={{ padding: '56px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
            <div style={{ display: 'flex', gap: 10 }} aria-hidden="true">
              <span className="badge" style={{ background: '#D6F3EA', transform: 'rotate(-6deg)' }}>⇄</span>
              <span className="badge" style={{ background: 'var(--accl)', transform: 'rotate(4deg)' }}>★</span>
              <span className="badge" style={{ background: '#E6DDF6', transform: 'rotate(-2deg)' }}>✎</span>
            </div>
            <h3 style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 900 }}>Your journey is just beginning</h3>
            <p className="muted" style={{ margin: 0, maxWidth: 440, fontSize: 16, lineHeight: 1.55 }}>
              Head over to the marketplace to discover skills and partners to train with.
            </p>
            <Link to="/marketplace" className="btn btn-p" style={{ marginTop: 6 }}>Explore Marketplace</Link>
          </div>
        )}

        {/* ---- NORMAL ---- */}
        {!isEmptyState && (
          <div className="grid">
            {/* LEFT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40, minWidth: 0 }}>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-labelledby="sv-lp">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 id="sv-lp" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Learning paths</h3>
                  <Link to="/progress" style={{ fontSize: 14, fontWeight: 800 }}>View all →</Link>
                </div>
                <div className="paths">
                  {learningSkills.map(p => {
                    const pct = Math.round(p.progress_percentage ?? 0)
                    return (
                      <Link key={p.id} to={`/progress`} className="card card-h" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, textDecoration: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 19, fontWeight: 900 }}>{p.skill_name}</span>
                            <span className="pill" style={STAGE_PILL[p.stage] || { background: '#EDE6D8' }}>{p.stage}</span>
                          </div>
                          <span style={{ font: "700 28px 'JetBrains Mono', monospace" }}>{pct}%</span>
                        </div>
                        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.skill_name} progress`}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        {p.what_happened && <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{p.what_happened}</span>}
                      </Link>
                    )
                  })}
                  <Link to="/marketplace" className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', borderStyle: 'dashed', boxShadow: 'none', minHeight: 170, background: 'transparent' }}>
                    <span style={{ width: 44, height: 44, borderRadius: 999, border: '2px solid #29251F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, background: '#FFFDF8' }}>+</span>
                    <span style={{ fontWeight: 800 }}>Find a skill to learn</span>
                  </Link>
                </div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }} aria-labelledby="sv-vb">
                <h3 id="sv-vb" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Verified badges</h3>
                <div className="card" style={{ padding: 26, display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {badgedSkills.map(s => (
                    <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 96 }}>
                      <span className="badge" style={{ background: s.badge === 'Gold' ? 'var(--acc)' : s.badge === 'Silver' ? '#D6F3EA' : '#FBEFC4' }}>★</span>
                      <span style={{ fontSize: 13, fontWeight: 800, textAlign: 'center' }}>{s.skill_name}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 96 }}>
                    <span className="badge" style={{ background: '#EDE6D8', borderStyle: 'dashed', boxShadow: 'none', color: '#8C8273' }}>🔒</span>
                    <span style={{ fontSize: 13, fontWeight: 800, textAlign: 'center', color: '#6E6455' }}>Locked</span>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
              <section className="card" style={{ overflow: 'hidden' }} aria-labelledby="sv-up">
                <div style={{ padding: '14px 20px', borderBottom: '2px dashed #29251F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accl)' }}>
                  <span id="sv-up" className="eb" style={{ color: '#29251F' }}>UPCOMING SESSION</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                </div>
                {nextSession ? (
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 48, height: 48, borderRadius: 999, border: '2px solid #29251F', background: '#E6DDF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                        {(peerName || '?').charAt(0).toUpperCase()}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontWeight: 900, fontSize: 17 }}>{peerName}</span>
                        {nextSession.skill_name && <span className="pill" style={{ background: '#D6F3EA', height: 24, fontSize: 11, alignSelf: 'flex-start' }}>{nextSession.skill_name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1, border: '2px solid #29251F', borderRadius: 12, padding: '10px 12px', background: '#F8F3E9' }}>
                        <span className="eb" style={{ fontSize: 10 }}>DATE</span>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>
                          {nextSession.scheduled_start
                            ? new Date(nextSession.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                            : '—'}
                        </div>
                      </div>
                      <div style={{ flex: 1, border: '2px solid #29251F', borderRadius: 12, padding: '10px 12px', background: '#F8F3E9' }}>
                        <span className="eb" style={{ fontSize: 10 }}>TIME</span>
                        <div style={{ font: "700 16px 'JetBrains Mono', monospace" }}>
                          {nextSession.scheduled_start
                            ? new Date(nextSession.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </div>
                      </div>
                    </div>
                    <Link to={`/session/${nextSession.id}`} className="btn btn-p">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#29251F" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>Enter Arena
                    </Link>
                  </div>
                ) : (
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                    <span className="muted" style={{ fontSize: 15 }}>You have no upcoming sessions scheduled.</span>
                    <Link to="/marketplace" style={{ fontWeight: 800, fontSize: 14 }}>Find a partner →</Link>
                  </div>
                )}
              </section>

              <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }} aria-labelledby="sv-qk">
                <span id="sv-qk" className="eb" style={{ marginBottom: 6 }}>QUICK LINKS</span>
                <Link to="/marketplace" className="ql"><span className="qi" style={{ background: '#D6F3EA' }}>⇄</span>Discover Partners<span style={{ marginLeft: 'auto' }}>→</span></Link>
                <Link to="/assessment" className="ql"><span className="qi" style={{ background: 'var(--accl)' }}>✓</span>Take a Skill Challenge<span style={{ marginLeft: 'auto' }}>→</span></Link>
                <Link to="/gamification" className="ql"><span className="qi" style={{ background: '#E6DDF6' }}>◎</span>View Full Journey<span style={{ marginLeft: 'auto' }}>→</span></Link>
              </section>

              <section className="card" style={{ padding: 20, background: '#FBEFC4', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="eb" style={{ color: '#29251F' }}>★ SKILLVERSE INSIGHT</span>
                <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.5, fontSize: 15 }}>
                  “Teaching a concept can reveal what you truly understand. Share your knowledge to solidify it.”
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
