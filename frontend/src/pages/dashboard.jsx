import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Trophy, CheckCircle, ClipboardCheck, Award, Users, Flame, Star, BookOpen, Compass, ArrowRight } from 'lucide-react'
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
  const location = useLocation()
  const user = getSessionUser()
  
  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)
  const [skills, setSkills] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [gamification, setGamification] = useState(null)
  const [weakTopic, setWeakTopic] = useState(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    
    // Extract transient weakTopic from URL query params
    const searchParams = new URLSearchParams(location.search)
    const topic = searchParams.get('weakTopic')
    if (topic) {
      setWeakTopic(topic)
      // Clean up URL so refresh doesn't preserve it indefinitely if unwanted, but we'll leave it for simplicity
    }
    
    let isMounted = true
    const loadingTimer = setTimeout(() => {
      if (isMounted) setShowLoading(true)
    }, 150)

    async function fetchDashboardData() {
      try {
        const [
          skillsData,
          upcomingData,
          gamiData
        ] = await Promise.all([
          api.mySkills().catch(() => []),
          api.upcomingSessions().catch(() => []),
          api.getGamificationSummary().catch(() => null)
        ])
        
        if (!isMounted) return;

        setSkills(skillsData || [])
        setUpcoming(upcomingData || [])
        setGamification(gamiData)
        
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
  }, [user, navigate, location.search])

  if (!user) return null

  const learningSkills = skills.filter(s => s.role === 'learning')
  const teachingSkills = skills.filter(s => s.role === 'teaching')
  const nextSession = upcoming.length > 0 ? upcoming[0] : null
  const activeLearningSkill = learningSkills.length > 0 ? learningSkills.reduce((prev, current) => (prev.progress_percentage > current.progress_percentage) ? prev : current) : null

  // Journey Decision Logic
  let heroState = {
    title: "Start your SkillVerse journey",
    description: "Discover partners and begin learning a new skill.",
    actionText: "Discover Partners →",
    actionUrl: "/marketplace"
  }

  if (nextSession) {
    heroState = {
      title: "Your next learning session is ready",
      description: `Session in ${nextSession.skill} on ${nextSession.session_date} at ${nextSession.start_time}.`,
      actionText: "Join Session →",
      actionUrl: `/session/${nextSession.id}`
    }
  } else if (weakTopic) {
    heroState = {
      title: "Keep working on your weak topics",
      description: `Based on your recent assessment, focus on improving: ${weakTopic}.`,
      actionText: `Find a teacher for ${weakTopic} →`,
      actionUrl: `/marketplace?q=${encodeURIComponent(weakTopic)}`
    }
  } else if (activeLearningSkill) {
    if (activeLearningSkill.progress_percentage === 0) {
      heroState = {
        title: `Assess your ${activeLearningSkill.skill_name} to see where you stand`,
        description: "Take an initial assessment to benchmark your current level and earn points.",
        actionText: "Take Assessment →",
        actionUrl: "/assessment"
      }
    } else if (activeLearningSkill.progress_percentage > 0 && activeLearningSkill.progress_percentage < 100) {
      heroState = {
        title: `Continue building your ${activeLearningSkill.skill_name} progress`,
        description: `You are at ${activeLearningSkill.progress_percentage}% progress. Schedule a session to keep growing.`,
        actionText: "Find a teacher →",
        actionUrl: "/marketplace"
      }
    } else if (activeLearningSkill.progress_percentage === 100 && !activeLearningSkill.badge) {
      heroState = {
        title: `You're ready to prove your ${activeLearningSkill.skill_name} skills`,
        description: "You've reached 100% progress. Take the final assessment to earn your verified badge.",
        actionText: "Assess your skill →",
        actionUrl: "/assessment"
      }
    } else if (activeLearningSkill.progress_percentage === 100 && activeLearningSkill.badge) {
      heroState = {
        title: `You've mastered ${activeLearningSkill.skill_name}`,
        description: "You hold a verified badge. Start teaching this skill or discover a new one to learn.",
        actionText: "Discover skill exchanges →",
        actionUrl: "/marketplace"
      }
    }
  } else if (teachingSkills.length > 0) {
    heroState = {
      title: "Keep growing your teaching skills",
      description: "You have skills ready to teach. Check your pending requests or find someone to help.",
      actionText: "View Requests →",
      actionUrl: "/requests"
    }
  }

  return (
    <div className="page space-y-6 md:space-y-8">
      
      <section className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-ink mb-1">
          My Skill Journey
        </h1>
        <p className="text-clay font-medium text-sm">
          Welcome back, {user.name.split(' ')[0]}. Here is where you stand and what to do next.
        </p>
      </section>

      {loading ? (
        showLoading ? (
          <div className="skeleton h-48 w-full rounded-2xl mb-8" />
        ) : null
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* JOURNEY HERO */}
            <div className="card bg-gradient-to-br from-brand/5 to-transparent border-0">
              <p className="text-xs font-bold text-brand uppercase tracking-wider mb-3">Your Next Step</p>
              <h2 className="text-2xl md:text-3xl font-bold text-ink mb-2 leading-tight">
                {heroState.title}
              </h2>
              <p className="text-clay font-medium mb-6">{heroState.description}</p>
              <Link to={heroState.actionUrl} className="btn-brand inline-flex text-base py-3 px-6 shadow-sm hover:shadow">
                {heroState.actionText}
              </Link>
            </div>

            {/* PROGRESS SNAPSHOT */}
            {learningSkills.length > 0 && (
              <section className="card">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-ink flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-clay" /> Active Learning
                  </h3>
                  <Link to="/progress" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
                    View full progress <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                
                <div className="space-y-4">
                  {learningSkills.slice(0, 2).map(s => (
                    <div key={s.id}>
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="font-bold text-ink">{s.skill_name}</p>
                          <p className="text-xs text-clay font-medium capitalize">{s.level} • {s.sessions_completed} sessions</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="text-xs font-bold text-brand2 bg-brandLight px-2 py-0.5 rounded-md">
                            {s.progress_percentage || 0}%
                          </span>
                          {s.badge && <SkillBadge badge={s.badge} />}
                        </div>
                      </div>
                      <div className="w-full bg-line rounded-full h-1.5">
                        <div className="bg-brand2 h-1.5 rounded-full transition-all duration-500" style={{ width: `${s.progress_percentage || 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            {teachingSkills.length > 0 && (
              <section className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-ink flex items-center gap-2">
                    <Compass className="w-5 h-5 text-clay" /> Teaching Skills
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teachingSkills.map(s => (
                    <div key={s.id} className="bg-lift px-4 py-2 rounded-xl flex items-center gap-2">
                      <span className="font-semibold text-sm">{s.skill_name}</span>
                      {s.badge && <SkillBadge badge={s.badge} />}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* SIDEBAR */}
          <div className="space-y-6">
            
            {/* GAMIFICATION / GROWTH SNAPSHOT */}
            <section className="card">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-ink flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-gold" /> Your Growth
                </h3>
              </div>
              
              <div className="text-center mb-6">
                <p className="text-4xl text-ink font-bold">{gamification?.total_points ?? user.points ?? 0}</p>
                <p className="text-xs font-bold text-gold uppercase tracking-wider mt-1">Total Points</p>
              </div>

              {gamification?.next_milestone_points && (
                <div className="mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-xs font-bold text-ink/60">Next: {gamification.next_milestone_title}</p>
                    <p className="text-xs text-ink/40">{gamification.total_points} / {gamification.next_milestone_points}</p>
                  </div>
                  <div className="w-full bg-paper h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gold h-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, ((gamification.total_points || 0) / gamification.next_milestone_points) * 100)}%` }} 
                    />
                  </div>
                </div>
              )}

              <Link to="/gamification" className="btn-secondary w-full justify-center text-sm">
                View Achievements & Leaderboard
              </Link>
            </section>

          </div>
        </div>
      )}
    </div>
  )
}

function SkillBadge({ badge }) {
  if (!badge) return null
  return (
    <span className="inline-flex items-center gap-1 bg-goldLight text-gold px-1.5 py-0.5 rounded text-[10px] font-bold border border-gold/20 shadow-sm">
      <CheckCircle className="w-3 h-3 text-brand" /> Verified
    </span>
  )
}
