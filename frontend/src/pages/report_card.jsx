import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import './report_card.css'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return String(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMinutes(mins) {
  const m = Number(mins) || 0
  if (m < 60) return `${m} mins`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h} hrs`
}

function Sparkline({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="muted" style={{ fontSize: 13, fontWeight: 700, padding: '12px 0' }}>
        No weekly history recorded yet.
      </div>
    )
  }

  const width = 280
  const height = 70
  const padding = 12

  if (history.length === 1) {
    const score = Math.round(history[0].score || 0)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
        <span className="pill" style={{ background: '#D6F3EA', fontSize: 13 }}>
          {history[0].week_start}: <strong>{score}%</strong>
        </span>
        <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
          1 week of recorded assessments
        </span>
      </div>
    )
  }

  const minScore = 0
  const maxScore = 100
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - 2 * padding)
    const y = height - padding - ((h.score - minScore) / (maxScore - minScore)) * (height - 2 * padding)
    return { x, y, score: Math.round(h.score), week: h.week_start }
  })

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
  }, '')

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <div style={{ width: '100%', overflowX: 'auto', padding: '6px 0' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', maxWidth: width, height, overflow: 'visible', display: 'block' }}
      >
        {/* Baseline guideline */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#D2BEA0"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {/* 50% guideline */}
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#EAE1D2"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        {/* Fill area */}
        <path d={fillD} fill="var(--accl)" opacity="0.6" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="4.5" fill="#FFFDF8" stroke="#29251F" strokeWidth="2" />
            <title>{`${pt.week}: ${pt.score}%`}</title>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#6E6455', marginTop: 4 }}>
        <span>{history[0].week_start}</span>
        <span>{history[history.length - 1].week_start}</span>
      </div>
    </div>
  )
}

export default function ReportCard() {
  const [activeTab, setActiveTab] = useState('student') // 'student' | 'teacher'
  const [reportCard, setReportCard] = useState(null)
  const [teacherStats, setTeacherStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [rc, ts] = await Promise.all([
          api.getMyReportCard().catch(err => {
            console.error('Failed to load report card', err)
            throw new Error('Unable to load report card details.')
          }),
          api.getMyTeacherStats().catch(err => {
            console.error('Failed to load teacher stats', err)
            return null
          }),
        ])
        setReportCard(rc)
        setTeacherStats(ts)
      } catch (err) {
        setError(err.message || 'Failed to load report data.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="sv-report-card">
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="sk" style={{ height: 100 }} />
          <div className="sk" style={{ height: 260 }} />
          <div className="grid2">
            <div className="sk" style={{ height: 320 }} />
            <div className="sk" style={{ height: 320 }} />
          </div>
        </div>
      </div>
    )
  }

  if (error || !reportCard) {
    return (
      <div className="sv-report-card">
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '60px clamp(16px, 3vw, 32px)' }}>
          <div className="card" style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 44 }}>⚠️</span>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Error Loading Academic Record</h2>
            <p className="muted" style={{ margin: 0, fontSize: 16 }}>{error || 'Unable to fetch your report card.'}</p>
            <button type="button" className="btn btn-p" onClick={() => window.location.reload()}>
              🔄 Try Again
            </button>
            <Link to="/profile" className="btn btn-s">← Return to Profile</Link>
          </div>
        </div>
      </div>
    )
  }

  const {
    skills_overview = [],
    progress_history = [],
    learning_activity = {},
    teaching_activity = {},
    exchange_history = [],
    points_breakdown = { total: 0, split: {} },
    reviews_received = {},
  } = reportCard

  const split = points_breakdown.split || {}

  return (
    <div className="sv-report-card">
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Header navigation & title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Link to="/profile" style={{ fontSize: 14, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              ← Back to Profile
            </Link>
            <div className="eb">PRIVATE ACADEMIC RECORD</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 900, lineHeight: 1.1 }}>
              Report Card & Performance
            </h1>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 500 }}>
              Verified skill mastery, learning history, and teaching credentials.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="tab-group">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => setActiveTab('student')}
            >
              <span>📊</span> Student Record
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'teacher' ? 'active' : ''}`}
              onClick={() => setActiveTab('teacher')}
            >
              <span>🎓</span> Teaching Stats
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: STUDENT REPORT CARD                                     */}
        {/* ============================================================== */}
        {activeTab === 'student' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Points Breakdown Section */}
            <section className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div>
                  <span className="eb">POINTS LEDGER</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>Total Experience Points</h2>
                </div>
                <div className="pill" style={{ background: 'var(--acc)', fontSize: 16, height: 38, padding: '0 16px', color: '#29251F' }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 900 }}>{points_breakdown.total}</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>PTS TOTAL</span>
                </div>
              </div>

              <div className="grid4">
                <div className="metric-card" style={{ background: '#FBEFC4' }}>
                  <span className="eb">INITIAL BONUS</span>
                  <span className="mono" style={{ fontSize: 28, fontWeight: 900 }}>{split.initial || 0}</span>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Base account creation</span>
                </div>
                <div className="metric-card" style={{ background: '#E6DDF6' }}>
                  <span className="eb">ASSESSMENTS</span>
                  <span className="mono" style={{ fontSize: 28, fontWeight: 900 }}>{split.assessment || 0}</span>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>50 pts per verified badge</span>
                </div>
                <div className="metric-card" style={{ background: '#D6F3EA' }}>
                  <span className="eb">TEACHING SESSIONS</span>
                  <span className="mono" style={{ fontSize: 28, fontWeight: 900 }}>{split.teaching || 0}</span>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>20 pts per completed session</span>
                </div>
                <div className="metric-card" style={{ background: 'var(--accl)' }}>
                  <span className="eb">REVIEWS SUBMITTED</span>
                  <span className="mono" style={{ fontSize: 28, fontWeight: 900 }}>{split.review || 0}</span>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>5 pts per session review</span>
                </div>
              </div>
            </section>

            {/* Skills Overview & Weekly Progress History */}
            <section className="card" style={{ padding: 28 }}>
              <div style={{ marginBottom: 20 }}>
                <span className="eb">VERIFIED CURRICULUM</span>
                <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>Skills Overview & Weekly Trends</h2>
                <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
                  Weekly progress tracks your first assessment attempt each Monday cycle.
                </span>
              </div>

              {skills_overview.length === 0 ? (
                <div style={{ padding: 32, border: '2px dashed #29251F', borderRadius: 14, textAlign: 'center', background: '#FFFDF8' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>No skills assessed yet.</p>
                  <span className="muted" style={{ fontSize: 14 }}>Take an assessment in the Skill Arena to establish your baseline level and track weekly progress.</span>
                  <div style={{ marginTop: 16 }}>
                    <Link to="/assessment" className="btn btn-p">Go to Skill Arena →</Link>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {skills_overview.map(skill => {
                    const historyObj = progress_history.find(p => p.skill_name === skill.skill_name)
                    const history = historyObj ? historyObj.history : []

                    const trendColor = skill.trend === 'up' ? '#D6F3EA' : skill.trend === 'down' ? '#FFE3CF' : '#F0E5D2'
                    const trendIcon = skill.trend === 'up' ? '↗' : skill.trend === 'down' ? '↘' : '→'
                    const trendLabel = skill.trend === 'up' ? 'Improving' : skill.trend === 'down' ? 'Needs Focus' : 'Steady'

                    return (
                      <div
                        key={skill.skill_name}
                        style={{
                          border: '2px solid #29251F',
                          borderRadius: 14,
                          padding: 20,
                          background: '#FFFDF8',
                          boxShadow: '0 3px 0 #29251F',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{skill.skill_name}</h3>
                            <span className="pill" style={{ background: '#E6DDF6', marginTop: 6, fontSize: 11 }}>
                              Level {skill.level_num}
                            </span>
                          </div>
                          <span className="pill" style={{ background: trendColor, fontSize: 12 }}>
                            {trendIcon} {trendLabel}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #29251F', borderRadius: 10, background: '#F8F3E9' }}>
                            <span className="eb" style={{ fontSize: 10 }}>BEST SCORE</span>
                            <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>
                              {skill.best_score != null ? `${skill.best_score}%` : '—'}
                            </div>
                          </div>
                          <div style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #29251F', borderRadius: 10, background: '#F8F3E9' }}>
                            <span className="eb" style={{ fontSize: 10 }}>COUNTED WEEKS</span>
                            <div className="mono" style={{ fontSize: 16, fontWeight: 800 }}>
                              {skill.counted_weeks}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="eb" style={{ fontSize: 10 }}>12-WEEK SCORE SPARKLINE</span>
                          <Sparkline history={history} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Learning Activity & Teaching Activity */}
            <div className="grid2">
              <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span className="eb">STUDENT ACTIVITY</span>
                  <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Learning Experience</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="metric-card" style={{ background: '#D6F3EA' }}>
                    <span className="eb">SESSIONS ATTENDED</span>
                    <span className="mono" style={{ fontSize: 26, fontWeight: 900 }}>{learning_activity.sessions_attended || 0}</span>
                  </div>
                  <div className="metric-card" style={{ background: '#F8F3E9' }}>
                    <span className="eb">LEARNING TIME</span>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 900 }}>
                      {formatMinutes(learning_activity.total_learning_minutes)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="eb">DISTINCT SKILLS LEARNED</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {(learning_activity.distinct_skills_learned || []).length > 0 ? (
                      learning_activity.distinct_skills_learned.map(sk => (
                        <span key={sk} className="pill" style={{ background: '#FFFDF8' }}>
                          📖 {sk}
                        </span>
                      ))
                    ) : (
                      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>No completed sessions as learner yet.</span>
                    )}
                  </div>
                </div>
              </section>

              <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span className="eb">TUTOR ACTIVITY</span>
                  <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Teaching Experience</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="metric-card" style={{ background: 'var(--accl)' }}>
                    <span className="eb">SESSIONS GIVEN</span>
                    <span className="mono" style={{ fontSize: 26, fontWeight: 900 }}>{teaching_activity.sessions_given || 0}</span>
                  </div>
                  <div className="metric-card" style={{ background: '#F8F3E9' }}>
                    <span className="eb">TEACHING TIME</span>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 900 }}>
                      {formatMinutes(teaching_activity.total_teaching_minutes)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="eb">DISTINCT SKILLS TAUGHT</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {(teaching_activity.distinct_skills_taught || []).length > 0 ? (
                      teaching_activity.distinct_skills_taught.map(sk => (
                        <span key={sk} className="pill" style={{ background: '#FFFDF8' }}>
                          🎓 {sk}
                        </span>
                      ))
                    ) : (
                      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>No completed sessions as teacher yet.</span>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Exchange History & Reviews Received */}
            <div className="grid2">
              <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span className="eb">COLLABORATION LOG</span>
                  <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Completed Exchanges</h3>
                </div>

                {exchange_history.length === 0 ? (
                  <div style={{ padding: 20, border: '2px dashed #29251F', borderRadius: 12, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
                      No completed peer exchanges or skill circles yet.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {exchange_history.map(ex => (
                      <div
                        key={ex.group_id}
                        style={{
                          padding: 14,
                          border: '2px solid #29251F',
                          borderRadius: 12,
                          background: '#FFFDF8',
                          boxShadow: '0 2px 0 #29251F',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15 }}>
                            {ex.kind === 'cycle' ? '🔄 3-Way Skill Circle' : '🤝 Two-Way Exchange'}
                          </div>
                          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                            With {ex.other_members.join(', ')}
                          </span>
                        </div>
                        <span className="pill" style={{ background: '#D6F3EA', fontSize: 11 }}>
                          Completed
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="eb">COMMUNITY REPUTATION</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Reviews Received</h3>
                  </div>
                  {reviews_received.review_count > 0 && (
                    <span className="pill" style={{ background: '#FBEFC4' }}>
                      ★ {reviews_received.average_rating?.toFixed(1) || '0.0'} ({reviews_received.review_count})
                    </span>
                  )}
                </div>

                {(!reviews_received.recent_reviews || reviews_received.recent_reviews.length === 0) ? (
                  <div style={{ padding: 20, border: '2px dashed #29251F', borderRadius: 12, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>No session reviews received yet.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reviews_received.recent_reviews.map((rev, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 14,
                          border: '2px solid #29251F',
                          borderRadius: 12,
                          background: '#FFFDF8',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#D97706', fontWeight: 900, fontSize: 14 }}>
                            {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                          </span>
                          <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                            {formatDate(rev.created_at)}
                          </span>
                        </div>
                        {rev.comment ? (
                          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, fontStyle: 'italic' }}>
                            "{rev.comment}"
                          </p>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Rating left without comment</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: TEACHING STATS                                          */}
        {/* ============================================================== */}
        {activeTab === 'teacher' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {!teacherStats || !teacherStats.has_taught ? (
              <section className="card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 84, height: 84, borderRadius: 999, border: '3px solid #29251F', background: 'var(--accl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, boxShadow: '0 4px 0 #29251F' }}>
                  🎓
                </div>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Teach your first session to see your stats here</h2>
                <p className="muted" style={{ margin: 0, fontSize: 16, maxWidth: 540, lineHeight: 1.6 }}>
                  As soon as you complete and deliver a learning session with a peer, your verified teaching hours, reliability rating, student retention, and skill breakdown will activate automatically.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link to="/marketplace" className="btn btn-p">Explore Teaching Requests →</Link>
                  <Link to="/requests" className="btn btn-s">View Pending Connects</Link>
                </div>
              </section>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* 4 Primary Highlight Stat Cards */}
                <div className="grid4">
                  <div className="metric-card" style={{ background: '#FBEFC4' }}>
                    <span className="eb">TEACHING HOURS</span>
                    <span className="mono" style={{ fontSize: 32, fontWeight: 900 }}>
                      {teacherStats.teaching_experience?.total_hours_taught || 0}
                    </span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                      Verified hours taught
                    </span>
                  </div>

                  <div className="metric-card" style={{ background: '#D6F3EA' }}>
                    <span className="eb">TEACHER RATING</span>
                    <span className="mono" style={{ fontSize: 32, fontWeight: 900 }}>
                      ★ {teacherStats.rating_summary?.average_rating?.toFixed(1) || '—'}
                    </span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                      From {teacherStats.rating_summary?.review_count || 0} review{teacherStats.rating_summary?.review_count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="metric-card" style={{ background: '#E6DDF6' }}>
                    <span className="eb">STUDENTS HELPED</span>
                    <span className="mono" style={{ fontSize: 32, fontWeight: 900 }}>
                      {teacherStats.students_help?.distinct_learners_taught || 0}
                    </span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                      {teacherStats.students_help?.returning_students_count || 0} returned for &ge;2 sessions
                    </span>
                  </div>

                  <div className="metric-card" style={{ background: 'var(--accl)' }}>
                    <span className="eb">RELIABILITY</span>
                    <span className="mono" style={{ fontSize: 32, fontWeight: 900 }}>
                      {teacherStats.reliability?.completion_rate || 0}%
                    </span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                      Completed vs cancelled
                    </span>
                  </div>
                </div>

                {/* Rating Distribution & Reliability breakdown */}
                <div className="grid2">
                  <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span className="eb">FEEDBACK PROFILE</span>
                        <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Star Breakdown</h3>
                      </div>
                      <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
                        Teaching since {teacherStats.teaching_experience?.teaching_since || 'recently'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[5, 4, 3, 2, 1].map(starsCount => {
                        const count = teacherStats.rating_summary?.star_breakdown?.[`star_${starsCount}`] || 0
                        const total = teacherStats.rating_summary?.review_count || 1
                        const pct = Math.round((count / total) * 100)

                        return (
                          <div key={starsCount} className="star-bar-row">
                            <span style={{ width: 48, flex: 'none' }}>★ {starsCount}</span>
                            <div className="star-track">
                              <div className="star-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="mono" style={{ width: 32, textAlign: 'right', fontSize: 12 }}>
                              {count}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <span className="eb">SESSION DELIVERY</span>
                      <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Session Performance</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="metric-card" style={{ background: '#F8F3E9' }}>
                        <span className="eb">TOTAL SESSIONS</span>
                        <span className="mono" style={{ fontSize: 24, fontWeight: 900 }}>
                          {teacherStats.session_stats?.total_sessions_taught || 0}
                        </span>
                      </div>
                      <div className="metric-card" style={{ background: '#F8F3E9' }}>
                        <span className="eb">AVG LENGTH</span>
                        <span className="mono" style={{ fontSize: 24, fontWeight: 900 }}>
                          {teacherStats.session_stats?.average_session_length || 0} min
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: 14, border: '2px solid #29251F', borderRadius: 12, background: '#D6F3EA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                        <span>Accepted Requests Completed</span>
                        <span>{teacherStats.reliability?.completed_sessions || 0} / {teacherStats.reliability?.total_accepted_requests || 0}</span>
                      </div>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                        {teacherStats.reliability?.cancelled_or_unscheduled || 0} requests were cancelled or never scheduled.
                      </span>
                    </div>
                  </section>
                </div>

                {/* Skill Breakdown Table */}
                <section className="card" style={{ padding: 24 }}>
                  <div style={{ marginBottom: 16 }}>
                    <span className="eb">SUBJECT EXPERTISE</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Skills Taught Breakdown</h3>
                  </div>

                  {!teacherStats.skill_breakdown || teacherStats.skill_breakdown.length === 0 ? (
                    <p className="muted" style={{ margin: 0, fontWeight: 600 }}>No skill breakdown available.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                      {teacherStats.skill_breakdown.map(sk => (
                        <div
                          key={sk.skill_name}
                          style={{
                            padding: 16,
                            border: '2px solid #29251F',
                            borderRadius: 14,
                            background: '#FFFDF8',
                            boxShadow: '0 3px 0 #29251F',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 900, fontSize: 17 }}>{sk.skill_name}</span>
                            <span className="pill" style={{ background: '#E6DDF6', fontSize: 11 }}>
                              Lvl {sk.level_num}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                            <span className="muted">Sessions Taught:</span>
                            <span className="mono">{sk.sessions_taught}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                            <span className="muted">Skill Rating:</span>
                            <span style={{ color: '#D97706', fontWeight: 900 }}>
                              {sk.average_rating != null ? `★ ${sk.average_rating.toFixed(1)}` : 'No reviews'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 5 Most Recent Teaching Reviews */}
                <section className="card" style={{ padding: 24 }}>
                  <div style={{ marginBottom: 16 }}>
                    <span className="eb">FEEDBACK LOG</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>Recent Student Reviews (Teacher)</h3>
                  </div>

                  {!teacherStats.recent_reviews || teacherStats.recent_reviews.length === 0 ? (
                    <p className="muted" style={{ margin: 0, fontWeight: 600 }}>No written reviews received for your teaching sessions yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                      {teacherStats.recent_reviews.map((rev, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: 16,
                            border: '2px solid #29251F',
                            borderRadius: 12,
                            background: '#FFFDF8',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#D97706', fontWeight: 900, fontSize: 14 }}>
                              {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                            </span>
                            <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                              {formatDate(rev.created_at)}
                            </span>
                          </div>
                          {rev.comment ? (
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, fontStyle: 'italic' }}>
                              "{rev.comment}"
                            </p>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>Rating left without text comment</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
