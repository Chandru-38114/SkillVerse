import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getAvatarUrl } from '../api'
import './fame.css'

const TABS = [
  { id: 'top_teachers', label: '🏆 Top Teachers', empty: 'No one has completed a teaching session yet.' },
  { id: 'most_knowledgeable', label: '🧠 Most Knowledgeable', empty: 'No verified Skill Arena scores yet.' },
  { id: 'rising_stars', label: '🚀 Rising Stars', empty: 'Rising Stars appear after 2+ weekly assessments in a course.' },
]
const QUALITY_LABELS = { clarity: 'Clarity', knowledge: 'Knowledge', communication: 'Communication', helpfulness: 'Helpfulness', patience: 'Patience' }

function Avatar({ p, size = 56 }) {
  const url = p.avatar_url ? getAvatarUrl(p.avatar_url) : null
  return url
    ? <img src={url} alt="" width={size} height={size} className="sv-fame-avatar" style={{ width: size, height: size }} />
    : <span className="sv-fame-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
}

function Score({ label, value, hint }) {
  return (
    <div className="sv-fame-score" title={hint}>
      <span className="v">{value == null ? '—' : Math.round(value)}</span>
      <span className="l">{label}</span>
    </div>
  )
}

function Insight({ person }) {
  const [insight, setInsight] = useState(person.insight)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function askAi() {
    setLoading(true); setError('')
    try {
      const res = await api.getTeacherInsight(person.user_id, true)
      setInsight(res.insight)
      if (res.insight && res.insight.source !== 'ai') setError('The AI is busy right now, so this is the keyword analysis.')
    } catch (err) {
      setError(err.message || 'Could not analyse the reviews')
    } finally {
      setLoading(false)
    }
  }
  if (!insight) return null
  const qualities = Object.entries(insight.qualities || {}).filter(([, v]) => v != null)
  return (
    <div className="sv-fame-insight">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="eb">{insight.source === 'ai' ? '✨ AI REVIEW SUMMARY' : 'REVIEW SUMMARY'}</span>
        {insight.source !== 'ai' && (
          <button type="button" className="sv-fame-btn sm" onClick={askAi} disabled={loading}>{loading ? 'Analysing…' : '✨ Analyse with AI'}</button>
        )}
      </div>
      <p style={{ margin: '6px 0' }}>{insight.summary}</p>
      {insight.strengths?.length > 0 && (
        <div className="sv-fame-chips">{insight.strengths.map(s => <span key={s} className="chip good">✓ {s}</span>)}</div>
      )}
      {insight.improvements?.length > 0 && (
        <div className="sv-fame-chips">{insight.improvements.map(s => <span key={s} className="chip warn">↗ {s}</span>)}</div>
      )}
      {qualities.length > 0 && (
        <div className="sv-fame-qual">
          {qualities.map(([q, v]) => (
            <div key={q}>
              <span>{QUALITY_LABELS[q]}</span>
              <span className="bar" aria-label={`${QUALITY_LABELS[q]} ${v} of 5`}><span style={{ width: `${v * 20}%` }} /></span>
            </div>
          ))}
        </div>
      )}
      {insight.flagged?.length > 0 && <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>{insight.flagged.length} suspicious review(s) ignored.</p>}
      {error && <p className="muted" role="status" style={{ margin: '6px 0 0', fontSize: 12 }}>{error}</p>}
    </div>
  )
}

function PersonCard({ p, rank, tab, featured }) {
  return (
    <article className={`sv-fame-card${featured ? ' featured' : ''}`}>
      <div className="sv-fame-rank" aria-label={`Rank ${rank}`}>#{rank}</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Avatar p={p} size={featured ? 76 : 56} />
        <div style={{ minWidth: 0 }}>
          <h3>{p.name}</h3>
          {p.college && <span className="muted" style={{ fontSize: 13 }}>{p.college}</span>}
          {p.average_rating != null && (
            <div style={{ fontWeight: 800, fontSize: 14 }}>⭐ {p.average_rating.toFixed(1)} <span className="muted" style={{ fontWeight: 600 }}>({p.review_count} learner{p.review_count === 1 ? '' : 's'})</span></div>
          )}
        </div>
      </div>

      <div className="sv-fame-scores">
        {tab === 'top_teachers' && <Score label="Fame" value={p.fame_score} hint="45% teaching + 35% knowledge + 20% activity" />}
        {tab === 'rising_stars' && <Score label="Gain" value={p.rising_gain} hint={`Weekly score gain in ${p.rising_course}`} />}
        <Score label="Teaching" value={p.teaching_score} hint="60% trusted rating + 40% learner improvement" />
        <Score label="Knowledge" value={p.knowledge_score} hint="Average of the last 4 counted weekly Skill Arena scores" />
        <Score label="Sessions" value={p.sessions_taught} hint="Completed teaching sessions" />
        <Score label="Students" value={p.students_taught} hint="Different learners taught" />
      </div>

      {tab === 'rising_stars' && p.rising_course && <p style={{ margin: 0, fontWeight: 800 }}>📈 +{p.rising_gain} points in {p.rising_course} over recent weeks</p>}

      <div className="sv-fame-chips">
        {p.courses.slice(0, 4).map(c => (
          <span key={c.name} className="chip">
            {c.name} · L{c.level_num}{c.badge ? ` · ${c.badge}` : ''}{c.score != null ? ` · ${Math.round(c.score)}%` : ''}
          </span>
        ))}
      </div>

      {(p.reasons.length > 0 || p.weekly.badges.length > 0 || p.certificates.length > 0) && (
        <div className="sv-fame-chips">
          {p.reasons.map(r => <span key={r} className="chip good">{r}</span>)}
          {p.weekly.badges.map(b => <span key={b.id} className="chip badge" title={b.description}>{b.icon} {b.name}</span>)}
          {p.certificates.length > 0 && <span className="chip badge">🎓 {p.certificates.length} certificate{p.certificates.length === 1 ? '' : 's'}</span>}
        </div>
      )}

      {tab === 'top_teachers' && <Insight person={p} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
        <span className="muted" style={{ fontSize: 13 }}>{p.contribution}</span>
        <Link className="sv-fame-btn sm" to={`/marketplace?q=${encodeURIComponent(p.name)}`}>View profile →</Link>
      </div>
    </article>
  )
}

export default function Fame() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('top_teachers')
  const [showFormula, setShowFormula] = useState(false)

  useEffect(() => {
    api.getFame().then(setData).catch(err => setError(err.message || 'Could not load the Fame page'))
  }, [])

  const list = data ? data[tab] : []
  const meta = TABS.find(t => t.id === tab)
  const weekly = data?.me?.weekly

  return (
    <div className="sv-fame"><div className="wrap">
      <header>
        <span className="eb">HALL OF FAME</span>
        <h1>SkillVerse Fame</h1>
        <p className="muted" style={{ margin: '6px 0 0', maxWidth: 760 }}>
          Celebrating the best teachers and the most knowledgeable members, ranked by a transparent score built on
          trusted reviews, measured learner improvement and verified weekly Skill Arena results.
        </p>
      </header>

      {weekly && (
        <section className="sv-fame-weekly" aria-label="Your weekly assessment">
          <div>
            <span className="eb">YOUR WEEKLY SKILL CHECK</span>
            <p style={{ margin: '4px 0 0', fontWeight: 800 }}>
              {weekly.this_week_done ? '✅ This week\'s assessment is done.' : '🗓️ This week\'s assessment is waiting for you.'}
              {' '}🔥 Streak: {weekly.current_streak} week{weekly.current_streak === 1 ? '' : 's'} · Best: {weekly.best_streak}
            </p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Only your first Skill Arena attempt each week counts, so retries can't change the ranking.</p>
            {weekly.badges.length > 0 && (
              <div className="sv-fame-chips" style={{ marginTop: 8 }}>
                {weekly.badges.map(b => <span key={b.id} className="chip badge" title={b.description}>{b.icon} {b.name}</span>)}
              </div>
            )}
          </div>
          {!weekly.this_week_done && <Link className="sv-fame-btn p" to="/assessment">Take this week's assessment</Link>}
        </section>
      )}

      <div className="sv-fame-tabs" role="tablist" aria-label="Fame categories">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <button type="button" className="sv-fame-btn sm" style={{ marginLeft: 'auto' }} aria-expanded={showFormula} onClick={() => setShowFormula(s => !s)}>
          How is this ranked?
        </button>
      </div>

      {showFormula && data && (
        <section className="sv-fame-formula">
          <ul>{Object.values(data.formula).map(f => <li key={f}>{f}</li>)}</ul>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Safeguards: one vote per reviewer, spam and repeated reviews ignored, a Bayesian prior so a few 5★ reviews
            can't beat a consistent record, activity capped at 10 sessions, and only the first weekly attempt counts.
            The AI only summarises reviews; it never changes a score.
          </p>
        </section>
      )}

      {error && <p className="sv-fame-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted">Loading the Hall of Fame…</p>}
      {data && list.length === 0 && <p className="muted">{meta.empty}</p>}
      {data && list.length > 0 && (
        <div className="sv-fame-list">
          {list.map((p, i) => <PersonCard key={p.user_id} p={p} rank={i + 1} tab={tab} featured={i === 0} />)}
        </div>
      )}
    </div></div>
  )
}
