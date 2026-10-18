import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import './progress.css'

const STAGES = ['Discovered', 'Baseline Established', 'Practicing', 'Developing', 'Mastery']
const STAGE_SHORT = ['Discovered', 'Baseline', 'Practicing', 'Developing', 'Mastery']
const MAX_COURSES = 4 // same limit as the backend (services/course_rules.py)

/* One row of the skill map: the course name and a 5-stop track. Every row and
   the header use the same grid columns, so the stops always line up. */
function JourneyRow({ skill }) {
  const teaching = skill.role === 'teaching'
  const reached = teaching ? STAGES.length - 1 : Math.max(0, STAGES.indexOf(skill.stage))
  const fill = `${(reached / (STAGES.length - 1)) * 80}%` // the line spans 10%..90% of the track
  return (
    <div className={`jr${teaching ? ' tutor' : ''}`}>
      <div className="jr-name">
        <span className="jr-title">{skill.skill_name}</span>
        <span className="jr-sub">{teaching ? '🎓 Tutor' : skill.stage}</span>
      </div>
      <div className="jr-track" role="img" aria-label={`${skill.skill_name}: ${teaching ? 'Tutor' : skill.stage}`}>
        <span className="jr-line" />
        <span className="jr-fill" style={{ width: fill }} />
        {STAGES.map((st, i) => (
          <span key={st} className={`jr-stop${i < reached ? ' done' : ''}${i === reached ? ' here' : ''}`} title={teaching ? 'Tutor' : st}>
            {i === reached ? (teaching ? '🎓' : '★') : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* "⋯" menu on a course card. For now it has one action: remove the course. */
function CourseMenu({ onRemove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="cmenu" ref={ref}>
      <button type="button" className="cmenu-btn" aria-label="Course options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#29251F" aria-hidden="true"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></svg>
      </button>
      {open && (
        <div className="cmenu-list" role="menu">
          <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onRemove() }}>
            Remove course
          </button>
        </div>
      )}
    </div>
  )
}

// The bar shows the server's progress_percentage: 16% per completed session
// (5 sessions = 80%), 100% only after passing the final challenge.
const barWidth = (skill) => `${Math.max(0, Math.min(100, skill.progress_percentage || 0))}%`

const BADGE_FILL = { Gold: 'var(--acc)', Silver: '#D6F3EA', Bronze: '#FBEFC4' }

export default function Progress() {
  const navigate = useNavigate()
  const [progressData, setProgressData] = useState([])
  const [historyData, setHistoryData] = useState([])
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [removing, setRemoving] = useState(null)     // the course being removed (confirm dialog)
  const [removeError, setRemoveError] = useState('')
  const [removeBusy, setRemoveBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => { if (mounted) setShowLoading(true) }, 150)

    async function loadData() {
      try {
        const pData = await api.getMyProgress()
        const hData = await api.getProgressHistory()
        const cData = await api.getMyCertificates()
        if (!mounted) return
        setProgressData(pData || [])
        setHistoryData(hData || [])
        setCertificates(cData || [])
      } catch (err) {
        if (mounted) setError(err.message || 'Could not load your progress.')
      } finally {
        if (mounted) { clearTimeout(timer); setLoading(false); setShowLoading(false) }
      }
    }
    loadData()
    return () => { mounted = false; clearTimeout(timer) }
  }, [reloadKey])

  const confirmRemove = async () => {
    setRemoveBusy(true)
    setRemoveError('')
    try {
      const res = await api.removeSkill(removing.id)
      setNotice(res?.detail || `${removing.skill_name} was removed.`)
      setRemoving(null)
      setReloadKey(k => k + 1)
    } catch (err) {
      setRemoveError(err.message || 'Could not remove this course.')
    } finally {
      setRemoveBusy(false)
    }
  }

  const handleGenerateCertificate = async (skillName) => {
    setGenerating(true)
    try {
      const newCert = await api.generateCertificate(skillName)
      navigate(`/certificate/${newCert.certificate_id}`)
    } catch (err) {
      setError(err.message || 'Could not generate the certificate.')
    } finally {
      setGenerating(false)
    }
  }

  const totalSessions = progressData.reduce((sum, s) => sum + (s.sessions_completed || 0), 0)
  const totalLearningMinutes = progressData.reduce((sum, s) => sum + (s.total_learning_minutes || 0), 0)
  const totalHours = Math.round((totalLearningMinutes / 60) * 10) / 10
  const isEmptyState = progressData.length === 0

  // Sessions per week over the last 8 weeks, counted from the history entries'
  // own timestamps. No invented numbers — if there is no history, the bars are empty.
  const weeks = (() => {
    const now = new Date()
    const buckets = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(now); end.setDate(now.getDate() - i * 7)
      const start = new Date(end); start.setDate(end.getDate() - 7)
      return { start, end, n: 0 }
    }).reverse()
    historyData.forEach(h => {
      const d = h.created_at ? new Date(h.created_at) : null
      if (!d || isNaN(d)) return
      const b = buckets.find(b => d > b.start && d <= b.end)
      if (b) b.n += 1
    })
    const max = Math.max(1, ...buckets.map(b => b.n))
    return buckets.map(b => ({ ...b, pct: Math.round((b.n / max) * 100) }))
  })()

  if (loading && showLoading) {
    return (
      <div className="sv-prog">
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div className="sk" style={{ height: 120 }} />
          <div className="sk" style={{ height: 340 }} />
          <div className="grid2"><div className="sk" style={{ height: 260 }} /><div className="sk" style={{ height: 260 }} /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="sv-prog">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* ---- header ---- */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="eb">MY PROGRESS</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px, 4.4vw, 54px)', fontWeight: 900, lineHeight: 1.03, letterSpacing: '-1.2px' }}>
            Track how your skills grow
          </h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="pill" style={{ height: 32, background: progressData.length > MAX_COURSES ? '#F6DDD8' : 'var(--accl)' }} title="You can have 4 courses at a time">
              {progressData.length} / {MAX_COURSES} courses
            </span>
            <span className="pill" style={{ height: 32 }}>{totalSessions} sessions completed</span>
            <span className="pill" style={{ height: 32 }}>{totalHours} hours learning</span>
          </div>
        </header>

        {progressData.length > MAX_COURSES && (
          <div className="note warn">
            You have {progressData.length} courses, but the limit is {MAX_COURSES} at a time. Remove the ones you're not using
            with the <b>⋯</b> menu on each course below, so you can add new ones later.
          </div>
        )}
        {notice && <div className="note ok" role="status">{notice}</div>}

        {error && (
          <div style={{ padding: '12px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 800 }}>{error}</div>
        )}

        {/* ---- empty ---- */}
        {isEmptyState && (
          <div className="card" style={{ padding: '56px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
            <div style={{ display: 'flex', gap: 10 }} aria-hidden="true">
              {[0, 1, 2, 3, 4].map(n => (
                <span key={n} style={{ width: 36, height: 36, borderRadius: 999, border: '2px dashed #29251F', display: 'inline-block', background: n === 0 ? 'var(--accl)' : 'transparent', borderStyle: n === 0 ? 'solid' : 'dashed' }} />
              ))}
            </div>
            <h3 style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 900 }}>Your skill journey is waiting</h3>
            <p className="muted" style={{ margin: 0, maxWidth: 440, fontSize: 16, lineHeight: 1.55 }}>
              Take a Skill Challenge to establish your baseline, and your map will start filling in.
            </p>
            <Link to="/assessment" className="btn btn-p" style={{ marginTop: 6 }}>Take a Skill Challenge</Link>
          </div>
        )}

        {!isEmptyState && (
          <>
            {/* ---- skill map ---- */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-labelledby="sv-map">
              <h2 id="sv-map" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Skill map</h2>
              <div className="jmap">
                <div className="jr jr-head" aria-hidden="true">
                  <div className="jr-name" />
                  <div className="jr-labels">
                    {STAGE_SHORT.map(st => <span key={st}>{st}</span>)}
                  </div>
                </div>
                {progressData.map(skill => <JourneyRow key={skill.id} skill={skill} />)}
              </div>
            </section>

            <div className="grid2">
              {/* ---- left: skills + history ---- */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 36, minWidth: 0 }}>
                <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-labelledby="sv-skills">
                  <h2 id="sv-skills" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Your skills</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {progressData.map(skill => {
                      const certForSkill = certificates.find(c => c.skill_name === skill.skill_name)
                      const teaching = skill.role === 'teaching'
                      const isEligible = !teaching && skill.stage === 'Mastery' && skill.progress_percentage >= 100
                      return (
                        <div key={skill.id} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 20, fontWeight: 900 }}>{skill.skill_name}</span>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {teaching
                                  ? <span className="pill" style={{ background: '#D6F3EA' }}>🎓 Tutor</span>
                                  : <>
                                      <span className="pill">Learning</span>
                                      <span className="pill" style={{ background: 'var(--accl)' }}>{skill.stage}</span>
                                    </>}
                                {skill.badge && <span className="pill" style={{ background: BADGE_FILL[skill.badge] || '#FBEFC4' }}>★ {skill.badge}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {skill.latest_score != null && (
                                <span className="mono" style={{ fontSize: 26, fontWeight: 700 }} title="Latest Skill Arena score">{Math.round(skill.latest_score)}%</span>
                              )}
                              <CourseMenu onRemove={() => { setRemoveError(''); setRemoving(skill) }} />
                            </div>
                          </div>

                          {!teaching && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, height: 14, borderRadius: 999, border: '2px solid #29251F', background: '#F0E5D2', overflow: 'hidden' }}>
                                <span style={{ display: 'block', height: '100%', width: barWidth(skill), background: 'var(--acc)', borderRight: skill.progress_percentage > 0 ? '2px solid #29251F' : 'none' }} />
                              </div>
                              <span className="mono" style={{ fontWeight: 800, fontSize: 14 }}>{skill.progress_percentage || 0}%</span>
                            </div>
                          )}

                          {skill.what_happened && <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{skill.what_happened}</p>}
                          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, fontWeight: 600 }}>
                            <span className="eb" style={{ marginRight: 8 }}>NEXT</span>
                            {skill.next_milestone || 'Keep learning and practicing to grow this skill.'}
                          </p>

                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {certForSkill ? (
                              <Link to={`/certificate/${certForSkill.certificate_id}`} className="btn btn-s">View certificate</Link>
                            ) : isEligible ? (
                              <button
                                type="button"
                                className="btn btn-p"
                                aria-disabled={generating}
                                disabled={generating}
                                onClick={() => handleGenerateCertificate(skill.skill_name)}
                              >
                                {generating ? 'Generating…' : 'Generate certificate'}
                              </button>
                            ) : teaching ? null : (
                              <span className="btn btn-g" aria-disabled="true">Certificate at 100%</span>
                            )}
                            {!teaching && skill.stage === 'Developing' && (
                              <Link to={`/assessment?skill=${encodeURIComponent(skill.skill_name)}&role=learning`} className="btn btn-p">Take the final challenge</Link>
                            )}
                            <Link to={`/marketplace?q=${encodeURIComponent(skill.skill_name)}`} className="btn btn-s">Find a partner</Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-labelledby="sv-hist">
                  <h2 id="sv-hist" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Learning history</h2>
                  {historyData.length === 0 ? (
                    <div className="card" style={{ padding: 24, borderStyle: 'dashed', boxShadow: 'none' }}>
                      <span className="muted">No completed sessions yet. Your history fills in as you learn.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {historyData.map(h => {
                        const before = h.progress_percentage_before
                        const after = h.progress_percentage_after
                        const improved = after != null && before != null && after > before
                        return (
                          <div key={h.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 900, fontSize: 16 }}>
                                {h.session?.skill_name || h.skill_name || 'Session'}
                              </span>
                              <span className="mono muted" style={{ fontSize: 13 }}>
                                {h.created_at ? new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                              </span>
                            </div>
                            {(before != null && after != null) && (
                              <span className="pill" style={{ alignSelf: 'flex-start', background: improved ? 'var(--accl)' : '#FFFDF8' }}>
                                {improved ? '↑ ' : ''}{before}% → {after}%
                              </span>
                            )}
                            {h.topics_discussed && (
                              <span style={{ fontSize: 14, fontWeight: 600 }}>
                                <span className="eb" style={{ marginRight: 8 }}>TOPICS</span>{h.topics_discussed}
                              </span>
                            )}
                            {h.semantic_summary && (
                              <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55, padding: '10px 12px', border: '2px solid #E2D3BB', borderRadius: 10, background: '#F8F3E9' }}>
                                {h.semantic_summary}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* ---- right: learning time ---- */}
              <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }} aria-labelledby="sv-time">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 id="sv-time" style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Learning time</h2>
                    <span className="eb">LAST 8 WEEKS</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: .9 }}>{totalHours}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, paddingBottom: 4 }}>hours</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                    {weeks.map((w, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, height: '100%' }}>
                        <div
                          title={`${w.n} session${w.n === 1 ? '' : 's'}`}
                          style={{ width: '100%', height: `${Math.max(6, w.pct)}%`, border: '2px solid #29251F', borderRadius: 6, background: w.n > 0 ? 'var(--acc)' : '#F0E5D2' }}
                        />
                        <span className="mono" style={{ fontSize: 10, color: '#6E6455' }}>{w.n}</span>
                      </div>
                    ))}
                  </div>
                  <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    Sessions completed per week, counted from your learning history.
                  </span>
                </section>

                <section className="card" style={{ padding: 20, background: '#FBEFC4', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="eb" style={{ color: '#29251F' }}>★ KEEP GOING</span>
                  <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.5, fontSize: 15 }}>
                    Complete 5 sessions (80%), then pass the final challenge with 60%+ to reach 100% — SkillVerse then issues a certificate anyone can verify.
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>

      {removing && (
        <div className="pmodal-bg" role="dialog" aria-modal="true" aria-labelledby="rm-title" onClick={(e) => { if (e.target === e.currentTarget && !removeBusy) setRemoving(null) }}>
          <div className="card pmodal">
            <span className="pmodal-icon" aria-hidden="true">🗑</span>
            <h3 id="rm-title" style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Remove {removing.skill_name}?</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
              This frees one of your {MAX_COURSES} course slots. Your past Skill Arena attempts, sessions and certificates stay in your history.
              {removing.role === 'teaching'
                ? ` You will stop appearing as a tutor for ${removing.skill_name}; to teach it again, pass the Skill Arena again.`
                : ` Your progress in ${removing.skill_name} (${removing.progress_percentage || 0}%) starts again if you add it back.`}
            </p>
            {removeError && <div className="note warn" style={{ margin: 0 }}>{removeError}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-s" style={{ flex: 1 }} disabled={removeBusy} onClick={() => setRemoving(null)}>Keep it</button>
              <button type="button" className="btn btn-danger" style={{ flex: 1 }} disabled={removeBusy} onClick={confirmRemove}>
                {removeBusy ? 'Removing…' : 'Remove course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
