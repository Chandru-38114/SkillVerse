import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, CheckCircle } from 'lucide-react'
import { api, getSessionUser } from '../api'

export default function Dashboard() {
  const navigate = useNavigate()
  const user = getSessionUser()
  
  const [loading, setLoading] = useState(true)
  const [skills, setSkills] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [gamification, setGamification] = useState(null)
  const [recommended, setRecommended] = useState([])
  const [completedSessions, setCompletedSessions] = useState(0)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    
    async function fetchDashboardData() {
      try {
        const [
          skillsData,
          upcomingData,
          sessionsData,
          gamiData,
          marketData
        ] = await Promise.all([
          api.mySkills().catch(() => []),
          api.upcomingSessions().catch(() => []),
          api.mySessions().catch(() => []),
          api.getGamificationSummary().catch(() => null),
          api.searchTeachers().catch(() => [])
        ])
        
        setSkills(skillsData || [])
        setUpcoming(upcomingData || [])
        setCompletedSessions(sessionsData?.filter(s => s.status === 'completed')?.length || 0)
        setGamification(gamiData)
        
        // Filter recommended teachers (exclude self)
        const others = (marketData || []).filter(u => u.user_id !== user.id)
        setRecommended(others.slice(0, 3))
      } catch (err) {
        console.error("Dashboard fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDashboardData()
  }, [user, navigate])

  if (!user) return null

  const learningSkills = skills.filter(s => s.role === 'learning')
  const teachingSkills = skills.filter(s => s.role === 'teaching')

  const nextSession = upcoming.length > 0 ? upcoming[0] : null
  const achievements = gamification?.earned_achievements || []

  return (
    <div className="page space-y-10">
      
      {/* 1. WELCOME SECTION */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-clay mt-1 font-medium">
            Continue learning, share your knowledge, and grow together.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/marketplace" className="btn-brand">Find a Teacher</Link>
          <Link to="/assessment" className="btn-secondary">Assess a Skill</Link>
        </div>
      </section>

      {/* 2. LEARNING OVERVIEW */}
      {loading ? (
        <OverviewSkeleton />
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Points" value={gamification?.total_points ?? user.points ?? 0} />
          <StatCard label="Current Rank" value={gamification?.current_rank ? `#${gamification.current_rank}` : '-'} />
          <StatCard label="Learning Skills" value={learningSkills.length} />
          <StatCard label="Teaching Skills" value={teachingSkills.length} />
          <StatCard label="Sessions Completed" value={completedSessions} />
        </section>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          {/* 3. UPCOMING SESSION */}
          <section>
            <SectionHeader title="Upcoming Session" />
            {loading ? (
              <div className="skeleton h-24 w-full" />
            ) : nextSession ? (
              <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-brand/20 bg-brandLight/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="status-accepted">{nextSession.status}</span>
                    <span className="text-sm font-semibold text-brand">{nextSession.skill}</span>
                  </div>
                  <p className="font-bold text-lg text-ink">
                    Session with {nextSession.tutor_id === user.id ? 'Student' : 'Teacher'} #{nextSession.tutor_id === user.id ? nextSession.learner_id : nextSession.tutor_id}
                  </p>
                  <p className="text-sm text-clay mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {`${nextSession.session_date} at ${nextSession.start_time}`}
                  </p>
                </div>
                <Link to={`/session/${nextSession.id}`} className="btn-brand">
                  Join Session
                </Link>
              </div>
            ) : (
              <div className="card p-8 text-center bg-paper/50">
                <p className="text-clay font-medium mb-3">No upcoming sessions</p>
                <Link to="/marketplace" className="btn-secondary text-sm">Discover Partners</Link>
              </div>
            )}
          </section>

          {/* 4. MY LEARNING SKILLS */}
          <section>
            <SectionHeader title="My Learning Skills" count={learningSkills.length} />
            {loading ? (
              <ListSkeleton />
            ) : learningSkills.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {learningSkills.map(s => (
                  <div key={s.id} className="card p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-ink">{s.skill_name}</h3>
                        <p className="text-xs text-clay font-medium mt-0.5 capitalize">{s.level}</p>
                      </div>
                      <span className="text-xs font-bold text-moss2 bg-mossLight px-2 py-1 rounded-md">
                        {s.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-line rounded-full h-1.5 mb-4">
                      <div className="bg-moss2 h-1.5 rounded-full" style={{ width: `${s.progress_percentage || 0}%` }} />
                    </div>
                    <Link to="/marketplace" className="text-xs font-semibold text-brand hover:underline">Find a Teacher ?</Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="You haven't added any learning skills yet." actionText="Find a Teacher" actionUrl="/marketplace" />
            )}
          </section>

          {/* 5. TEACHING SKILLS */}
          <section>
            <SectionHeader title="Skills I Teach" count={teachingSkills.length} />
            {loading ? (
              <ListSkeleton />
            ) : teachingSkills.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {teachingSkills.map(s => (
                  <div key={s.id} className="card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-ink">{s.skill_name}</h3>
                        <SkillBadge badge={s.badge} />
                      </div>
                      <p className="text-xs text-clay font-medium mt-1 capitalize">{s.level}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-line">
                      <Link to="/requests" className="text-xs font-semibold text-brand hover:underline">View Requests ?</Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="You haven't assessed any skills to teach." actionText="Assess a Skill" actionUrl="/assessment" />
            )}
          </section>
        </div>

        {/* SIDEBAR GRID */}
        <div className="space-y-8">
          
          {/* 6. GAMIFICATION SUMMARY */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Achievements</h2>
              <Link to="/gamification" className="text-xs font-bold text-brand hover:underline">View All</Link>
            </div>
            <div className="card p-5">
              {loading ? (
                <div className="space-y-3">
                  <div className="skeleton h-12 w-full" />
                  <div className="skeleton h-12 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-bold text-gold uppercase tracking-wider">Total Points</p>
                      <p className="font-display text-2xl font-bold text-ink">{gamification?.total_points ?? user.points ?? 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-goldLight rounded-full flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-gold" />
                    </div>
                  </div>
                  
                  {achievements.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-clay uppercase tracking-wider mb-2">Recent Badges</p>
                      {achievements.slice(0, 3).map(a => (
                        <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-paper transition-colors">
                          <div className="w-8 h-8 flex items-center justify-center bg-goldLight/50 border border-gold/20 rounded-full text-lg shadow-sm">
                            {a.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">{a.title}</p>
                            <p className="text-[10px] font-medium text-clay truncate max-w-[150px]">{a.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-clay text-center py-2">No achievements yet. Keep learning!</p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* 7. RECOMMENDED PEERS */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Recommended Peers</h2>
              <Link to="/marketplace" className="text-xs font-bold text-brand hover:underline">Explore</Link>
            </div>
            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-5 space-y-4">
                  <div className="skeleton h-10 w-full" />
                  <div className="skeleton h-10 w-full" />
                </div>
              ) : recommended.length > 0 ? (
                <div className="divide-y divide-line">
                  {recommended.map(peer => (
                    <div key={peer.user_id} className="p-4 hover:bg-paper transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brandLight text-brand rounded-full flex items-center justify-center font-bold text-sm">
                          {peer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ink">{peer.name}</p>
                          <p className="text-xs text-clay font-medium truncate max-w-[120px]">
                            {peer.teaching_skills?.length ? peer.teaching_skills[0].skill_name : 'New Member'}
                          </p>
                        </div>
                      </div>
                      <Link to={`/marketplace`} className="text-xs font-semibold text-brand hover:underline px-2 py-1 rounded bg-brandLight/30">Connect</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-clay mb-2">No recommendations available</p>
                  <Link to="/marketplace" className="btn-secondary text-xs py-1.5">Search Marketplace</Link>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      {count !== undefined && (
        <span className="bg-line text-clay text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4 flex flex-col justify-center items-center text-center">
      <p className="text-[11px] font-bold text-clay uppercase tracking-wider mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}

function EmptyState({ message, actionText, actionUrl }) {
  return (
    <div className="card p-8 flex flex-col items-center justify-center text-center border-dashed border-2 bg-transparent shadow-none">
      <div className="w-12 h-12 bg-line/50 rounded-full flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
      <p className="text-sm text-ink font-medium mb-4">{message}</p>
      <Link to={actionUrl} className="btn-secondary text-sm">{actionText}</Link>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-4 h-20 skeleton" />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="card p-5 h-28 skeleton" />
      <div className="card p-5 h-28 skeleton" />
    </div>
  )
}

function SkillBadge({ badge }) {
  if (!badge) return null
  return (
    <span className="inline-flex items-center gap-1 bg-goldLight text-gold px-2 py-1 rounded text-xs font-bold border border-gold/20 shadow-sm">
      <CheckCircle className="w-4 h-4 text-moss" /> Verified
    </span>
  )
}



