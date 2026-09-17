import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, CheckCircle, ClipboardCheck, Award, Users, Flame, Star } from 'lucide-react'
import { api, getSessionUser } from '../api'

const ACHIEVEMENT_ICONS = {
  first_assessment: <ClipboardCheck className="w-8 h-8" />,
  first_badge: <Award className="w-8 h-8" />,
  first_session: <Users className="w-8 h-8" />,
  five_sessions: <Flame className="w-8 h-8" />,
  first_review: <Star className="w-8 h-8" />,
  points_500: <Trophy className="w-8 h-8" />
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = getSessionUser()
  
  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)
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
    
    let isMounted = true
    const loadingTimer = setTimeout(() => {
      if (isMounted) setShowLoading(true)
    }, 150) // Only show skeleton if fetch takes more than 150ms

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
        
        if (!isMounted) return;

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
        if (isMounted) {
          clearTimeout(loadingTimer)
          setLoading(false)
          setShowLoading(false)
        }
      }
    }
    
    fetchDashboardData()

    return () => {
      isMounted = false
      clearTimeout(loadingTimer)
    }
  }, [user, navigate])

  if (!user) return null

  const learningSkills = skills.filter(s => s.role === 'learning')
  const teachingSkills = skills.filter(s => s.role === 'teaching')

  const nextSession = upcoming.length > 0 ? upcoming[0] : null
  const achievements = gamification?.earned_achievements || []

  return (
    <div className="page space-y-6 md:space-y-10">
      
      {/* 1. WELCOME SECTION */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-clay mt-1 font-medium">
            Continue learning, share your knowledge, and grow together.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link to="/marketplace" className="btn-brand">Find a Teacher</Link>
          <Link to="/assessment" className="btn-secondary">Assess a Skill</Link>
        </div>
      </section>

      {/* 2. LEARNING OVERVIEW */}
      {showLoading ? (
        <OverviewSkeleton />
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <StatCard label="Total Points" value={gamification?.total_points ?? user.points ?? 0} />
          <StatCard label="Current Rank" value={gamification?.current_rank ? `#${gamification.current_rank}` : '-'} />
          <StatCard label="Learning Skills" value={learningSkills.length} />
          <StatCard label="Teaching Skills" value={teachingSkills.length} />
          <StatCard label="Sessions Completed" value={completedSessions} className="col-span-2 md:col-span-1" />
        </section>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        <div className="lg:col-span-2 space-y-6 md:space-y-6 md:space-y-8">
          {/* 3. UPCOMING SESSION */}
          <section>
            <SectionHeader title="Upcoming Session" />
            {showLoading ? (
              <div className="skeleton h-24 w-full" />
            ) : nextSession ? (
              <div className="card p-5 sm:p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-brand/20 bg-brand/10">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="status-accepted shrink-0">{nextSession.status}</span>
                    <span className="text-sm font-semibold text-brand truncate">{nextSession.skill}</span>
                  </div>
                  <p className="font-bold text-lg text-ink truncate">
                    Session with {nextSession.tutor_id === user.id ? 'Student' : 'Teacher'} #{nextSession.tutor_id === user.id ? nextSession.learner_id : nextSession.tutor_id}
                  </p>
                  <p className="text-sm text-clay mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {`${nextSession.session_date} at ${nextSession.start_time}`}
                  </p>
                </div>
                <Link to={`/session/${nextSession.id}`} className="btn-brand w-full sm:w-auto shrink-0">
                  Join Session
                </Link>
              </div>
            ) : (
              <div className="card p-5 sm:p-8 text-center bg-paper/50">
                <p className="text-clay font-medium mb-3">No upcoming sessions</p>
                <Link to="/marketplace" className="btn-secondary text-sm">Discover Partners</Link>
              </div>
            )}
          </section>

          {/* 4. MY LEARNING SKILLS */}
          <section>
            <SectionHeader title="My Learning Skills" count={learningSkills.length} />
            {showLoading ? (
              <ListSkeleton />
            ) : learningSkills.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {learningSkills.map(s => (
                  <div key={s.id} className="card p-4 md:p-5">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-ink line-clamp-2 break-words">{s.skill_name}</h3>
                        <p className="text-xs text-clay font-medium mt-0.5 capitalize">{s.level}</p>
                      </div>
                      <span className="text-xs font-bold text-moss2 bg-mossLight px-2 py-1 rounded-md shrink-0">
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
            {showLoading ? (
              <ListSkeleton />
            ) : teachingSkills.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {teachingSkills.map(s => (
                  <div key={s.id} className="card p-4 md:p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-ink line-clamp-2 break-words">{s.skill_name}</h3>
                        <div className="shrink-0">
                          <SkillBadge badge={s.badge} />
                        </div>
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
        <div className="space-y-6 md:space-y-6 md:space-y-8">
          
          {/* 6. GAMIFICATION SUMMARY */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Skill Journey</h2>
              <Link to="/gamification" className="text-xs font-bold text-brand hover:underline">View All</Link>
            </div>
            <div className="card p-5">
              {showLoading ? (
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
                          <div className="flex-shrink-0 text-gold">
                            {ACHIEVEMENT_ICONS[a.id] || <Award className="w-8 h-8" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink truncate">{a.title}</p>
                            <p className="text-[10px] font-medium text-clay truncate">{a.description}</p>
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
              {showLoading ? (
                <div className="p-5 space-y-4">
                  <div className="skeleton h-10 w-full" />
                  <div className="skeleton h-10 w-full" />
                </div>
              ) : recommended.length > 0 ? (
                <div className="divide-y divide-line">
                  {recommended.map(peer => (
                    <div key={peer.user_id} className="p-4 hover:bg-paper transition-colors flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-brandLight text-brand rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                          {peer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink truncate">{peer.name}</p>
                          <p className="text-xs text-clay font-medium truncate">
                            {peer.teaching_skills?.length ? peer.teaching_skills[0].skill_name : 'New Member'}
                          </p>
                        </div>
                      </div>
                      <Link to={`/marketplace`} className="text-xs font-semibold text-brand hover:underline px-3 py-1.5 rounded bg-brand/15 shrink-0">Connect</Link>
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

function StatCard({ label, value, className = "" }) {
  return (
    <div className={`card p-4 flex flex-col justify-center items-center text-center ${className}`}>
      <p className="text-[11px] font-bold text-clay uppercase tracking-wider mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}

function EmptyState({ message, actionText, actionUrl }) {
  return (
    <div className="card p-5 sm:p-8 flex flex-col items-center justify-center text-center border-dashed border-2 bg-transparent shadow-none">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-4 h-20 skeleton" />
      ))}
      <div className="card p-4 h-20 skeleton col-span-2 md:col-span-1" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
      <div className="card p-4 md:p-5 h-28 skeleton" />
      <div className="card p-4 md:p-5 h-28 skeleton hidden sm:block" />
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



