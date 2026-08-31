import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import SkillBadge from '../components/SkillBadge'

export default function Dashboard() {
  const [user, setUser] = useState(getSessionUser())
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.refreshMe().then(setUser).catch(() => {}),
      api.mySkills().then(setSkills),
    ]).finally(() => setLoading(false))
  }, [])

  const teachingSkills = skills.filter((s) => s.role === 'teaching')
  const learningSkills = skills.filter((s) => s.role === 'learning')

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
        <div>
          <p className="label-eyebrow mb-1">Dashboard</p>
          <h1 className="font-display text-4xl">
            Hello, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-ink/50 text-sm mt-1">Here's your skills overview.</p>
        </div>

        {/* Points card */}
        <div className="card px-6 py-4 text-right min-w-[140px]">
          <p className="label-eyebrow mb-1">Points</p>
          <p className="font-display text-4xl text-clay">{user?.points ?? '—'}</p>
          <p className="text-xs text-ink/40 mt-1">SkillVerse pts</p>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link to="/assessment" className="btn-primary">+ Assess a skill</Link>
        <Link to="/marketplace" className="btn-secondary">Browse teachers</Link>
        <Link to="/requests" className="btn-secondary">My requests</Link>
      </div>

      {/* ── Skills ── */}
      {loading ? (
        <SkillsSkeleton />
      ) : skills.length === 0 ? (
        <EmptySkills />
      ) : (
        <div className="space-y-8">
          {teachingSkills.length > 0 && (
            <SkillSection title="Teaching" skills={teachingSkills} />
          )}
          {learningSkills.length > 0 && (
            <SkillSection title="Learning" skills={learningSkills} />
          )}
        </div>
      )}
    </div>
  )
}

function SkillSection({ title, skills }) {
  return (
    <div>
      <h2 className="font-display text-xl mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-body text-ink/40 font-normal">({skills.length})</span>
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        {skills.map((s) => (
          <div key={s.id} className="card-hover p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-base">{s.skill_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-ink/40 font-mono">{s.level}</span>
                {s.latest_score != null && (
                  <>
                    <span className="text-ink/20">·</span>
                    <span className="text-xs text-ink/40 font-mono">{s.latest_score}%</span>
                  </>
                )}
              </div>
            </div>
            <SkillBadge badge={s.badge} />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptySkills() {
  return (
    <div className="card p-12 text-center">
      <p className="text-4xl mb-4">🎯</p>
      <h2 className="font-display text-xl mb-2">No skills assessed yet</h2>
      <p className="text-ink/50 text-sm mb-6 max-w-sm mx-auto">
        Take a short assessment to get a verified badge — it's how other members know you can teach.
      </p>
      <Link to="/assessment" className="btn-primary">Take your first assessment</Link>
    </div>
  )
}

function SkillsSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-5 flex items-center justify-between">
          <div className="space-y-2">
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton h-3 w-16 rounded" />
          </div>
          <div className="skeleton h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}