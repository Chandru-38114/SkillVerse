import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import SkillBadge from '../components/skillbadge'

export default function Dashboard() {
  const [user, setUser] = useState(getSessionUser())
  const [skills, setSkills] = useState([])
  const [gamification, setGamification] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.refreshMe().then(setUser).catch(() => {}),
      api.mySkills().then(setSkills),
      api.getGamificationSummary().then(setGamification).catch(() => {})
    ]).finally(() => setLoading(false))
  }, [])

  const teachingSkills = skills.filter((s) => s.role === 'teaching')
  const learningSkills = skills.filter((s) => s.role === 'learning')
  
  const earnedAchievements = gamification?.achievements.filter(a => a.earned) || [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* --- Header --- */}
      <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
        <div>
          <p className="label-eyebrow mb-1">Dashboard</p>
          <h1 className="font-display text-4xl">
            Hello, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-ink/50 text-sm mt-1">Here's your skills overview.</p>
        </div>

        {/* Gamification Stats */}
        <div className="flex gap-4">
          <Link to="/gamification" className="card-hover px-6 py-4 text-right min-w-[140px] block border-clay/30 bg-clay/5">
            <p className="label-eyebrow mb-1 text-clay">Points</p>
            <p className="font-display text-4xl text-clay">{gamification?.total_points ?? user?.points ?? '—'}</p>
            {gamification?.current_rank && (
              <p className="text-xs text-clay/70 mt-1 font-bold">Rank #{gamification.current_rank}</p>
            )}
          </Link>
          {gamification?.next_milestone_points && (
            <div className="card px-6 py-4 text-left min-w-[200px] hidden sm:block">
              <p className="label-eyebrow mb-1">Next Milestone</p>
              <p className="font-bold text-sm">{gamification.next_milestone_title}</p>
              <div className="w-full bg-sand/50 h-2 rounded-full mt-2 mb-1 overflow-hidden">
                <div 
                  className="bg-clay h-full" 
                  style={{ width: `${Math.min(100, ((gamification.total_points || 0) / gamification.next_milestone_points) * 100)}%` }} 
                />
              </div>
              <p className="text-xs text-ink/50 text-right">{gamification.total_points} / {gamification.next_milestone_points} pts</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Quick actions --- */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link to="/assessment" className="btn-primary">+ Assess a skill to Teach</Link>
        <Link to="/marketplace" className="btn-secondary">Browse teachers</Link>
        <Link to="/requests" className="btn-secondary">My requests</Link>
        <Link to="/gamification" className="btn-secondary ml-auto text-clay border-clay hover:bg-clay/5">🏆 Leaderboard & Achievements</Link>
      </div>

      {/* --- Skills --- */}
      {loading ? (
        <SkillsSkeleton />
      ) : (
      <div className="space-y-8">
        
        {/* Achievements Quick View (if they have any) */}
        {earnedAchievements.length > 0 && (
          <div className="mb-8">
             <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              Recent Achievements
            </h2>
            <div className="flex flex-wrap gap-3">
              {earnedAchievements.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1.5 shadow-sm">
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-xs font-bold text-yellow-800">{a.title}</span>
                </div>
              ))}
              {earnedAchievements.length > 4 && (
                <Link to="/gamification" className="flex items-center text-xs font-bold text-clay ml-2">+{earnedAchievements.length - 4} more</Link>
              )}
            </div>
          </div>
        )}

        {teachingSkills.length > 0 && (
          <SkillSection title="Skills I Teach" skills={teachingSkills} />
        )}
        
        <div>
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            Skills I Want to Learn
            <span className="text-sm font-body text-ink/40 font-normal">({learningSkills.length})</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {learningSkills.map((s) => (
              <div key={s.id} className="card-hover p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-base">{s.skill_name}</p>
                  <p className="text-xs text-ink/40 mt-1">{s.level}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-600">{s.progress_percentage || 0}%</div>
                  <button 
                    className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs mt-1"
                    onClick={async () => {
                      if(confirm(`Remove ${s.skill_name}?`)) {
                        await api.deleteMySkill(s.id);
                        api.mySkills().then(setSkills);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form 
            className="flex gap-2 max-w-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              const input = e.target.elements.skill;
              if (!input.value.trim()) return;
              try {
                await api.addMySkill(input.value.trim());
                input.value = '';
                api.mySkills().then(setSkills);
              } catch(err) {
                alert(err.message);
              }
            }}
          >
            <input name="skill" className="input text-sm flex-1" placeholder="e.g. React, SQL" />
            <button className="btn-secondary py-1.5 text-sm">Add</button>
          </form>
        </div>
        
        {skills.length === 0 && (
          <EmptySkills />
        )}

        <div className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-blue-900 mb-1">Your Learning Progress</h2>
            <p className="text-sm text-blue-800/70">Track your knowledge history across sessions.</p>
          </div>
          <Link to="/progress" className="btn-primary bg-blue-600 hover:bg-blue-700">View Full Progress →</Link>
        </div>
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
                    <span className="text-ink/20">•</span>
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
