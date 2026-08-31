import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import SkillBadge from '../components/skillbadge'

export default function Dashboard() {
  const user = getSessionUser()
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.mySkills().then(setSkills).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="label-eyebrow mb-1">Welcome back</p>
          <h1 className="font-display text-3xl">{user?.name}</h1>
        </div>
        <div className="text-right">
          <p className="label-eyebrow mb-1">Points balance</p>
          <p className="font-mono text-2xl text-clay">{user?.points}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl">Your skills</h2>
        <Link to="/assessment" className="btn-secondary text-sm py-1.5">+ Assess a new skill</Link>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : skills.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink/60 mb-4">You haven't taken any assessments yet.</p>
          <Link to="/assessment" className="btn-primary inline-block">Take your first assessment</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {skills.map((s) => (
            <div key={s.id} className="card p-5 flex items-center justify-between">
              <div>
                <p className="font-display text-lg">{s.skill_name}</p>
                <p className="text-xs text-ink/50 font-mono">{s.role} · {s.level} · {s.latest_score ?? '—'}%</p>
              </div>
              <SkillBadge badge={s.badge} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
