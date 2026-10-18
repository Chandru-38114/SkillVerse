// Extra panels on the Skill Arena result page: the topic "skill shape"
// (radar chart), a topic-by-topic breakdown and the badge ladder.
import RadarChart from './RadarChart'

const LADDER = [
  { name: 'Bronze', at: 40, color: '#E8B48A' },
  { name: 'Silver', at: 60, color: '#D9D6CF' },
  { name: 'Gold', at: 75, color: '#F5CF5B' },
  { name: 'Expert', at: 90, color: '#B9A6EE' },
]
const STRONG = 75   // a topic at/above this is a strength
const WEAK = 60     // below this is a weak topic (same rule as the server)

function BadgeLadder({ score }) {
  const next = LADDER.find(t => score < t.at)
  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span className="eb">🏅 BADGE LADDER</span>
        <strong style={{ fontSize: 15 }}>
          {next ? `${Math.ceil(next.at - score)}% more for ${next.name}` : 'Top tier reached — Expert!'}
        </strong>
      </div>
      <div style={{ position: 'relative', height: 18, border: '2px solid #29251F', borderRadius: 999, background: '#F0E5D2', margin: '14px 6px 30px' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, score)}%`, background: 'var(--acc)', borderRadius: 999, transition: 'width .9s ease' }} />
        {LADDER.map(t => (
          <div key={t.name} style={{ position: 'absolute', left: `${t.at}%`, top: -10, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span title={`${t.name} badge at ${t.at}%`} style={{
              width: 30, height: 30, borderRadius: 999, border: '2px solid #29251F', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: score >= t.at ? t.color : '#FFFDF8', boxShadow: '0 2px 0 #29251F', fontSize: 13,
            }}>{score >= t.at ? '★' : '·'}</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{t.name} {t.at}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ArenaResultInsights({ result, skillName }) {
  const mastery = Object.entries(result.topic_mastery || {})
    .map(([topic, pct]) => ({ topic, pct: Number(pct) || 0 }))
  const sorted = [...mastery].sort((a, b) => b.pct - a.pct)
  const axes = mastery.map(m => ({ label: m.topic, value: m.pct }))

  return (
    <>
      {mastery.length > 0 && (
        <div className="two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 20 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="eb">🕸 YOUR {skillName?.toUpperCase()} SHAPE</span>
            <span className="muted" style={{ fontSize: 14 }}>How you scored in each topic. A bigger shape means stronger all-round skills.</span>
            {axes.length >= 3 ? (
              <RadarChart axes={axes} size={280} />
            ) : (
              <span className="muted" style={{ fontSize: 14 }}>Not enough topics for a shape — see the breakdown.</span>
            )}
          </div>

          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="eb">📊 TOPIC BREAKDOWN</span>
            {sorted.map(({ topic, pct }) => {
              const tag = pct >= STRONG ? { t: 'Strength', bg: '#D6F3EA' } : pct < WEAK ? { t: 'Work on this', bg: '#F6DDD8' } : { t: 'Okay', bg: '#FBEFC4' }
              return (
                <div key={topic} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong style={{ fontSize: 15 }}>{topic}</strong>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="pill" style={{ background: tag.bg, height: 24, fontSize: 11 }}>{tag.t}</span>
                      <span className="mono" style={{ fontWeight: 800, minWidth: 44, textAlign: 'right' }}>{Math.round(pct)}%</span>
                    </span>
                  </div>
                  <div style={{ height: 10, border: '2px solid #29251F', borderRadius: 999, background: '#F0E5D2', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= STRONG ? '#3FB58F' : pct < WEAK ? '#E2533A' : 'var(--acc)', transition: 'width .9s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <BadgeLadder score={Number(result.score) || 0} />
    </>
  )
}
