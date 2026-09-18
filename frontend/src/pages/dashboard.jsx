import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Trophy, CheckCircle, ClipboardCheck, Award, Users, Flame, Star, BookOpen, Compass, ArrowRight, Calendar } from 'lucide-react'
import { api, getSessionUser } from '../api'
import Avatar from '../components/ui/Avatar'

function getProgressNarrative(progress, badge) {
  if (progress === 100 && badge) return "Skill milestone reached";
  if (progress === 100) return "Ready for final assessment";
  if (progress >= 81) return "Close to the next milestone";
  if (progress >= 61) return "Developing confidence";
  if (progress >= 41) return "Making steady progress";
  if (progress >= 21) return "Building fundamentals";
  return "Getting started";
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
    
    const searchParams = new URLSearchParams(location.search)
    const topic = searchParams.get('weakTopic')
    if (topic) {
      setWeakTopic(topic)
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

  // Journey Decision Logic (A1)
  let heroState = {
    title: "Choose a skill to start your journey.",
    description: "Assess a skill to discover people who can help you grow.",
    actionText: "Assess a skill",
    actionUrl: "/assessment"
  }

  if (nextSession) {
    const peerName = nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name;
    const dateStr = new Date(nextSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    heroState = {
      title: "Your next learning session is coming up.",
      description: `You are learning ${nextSession.skill} with ${peerName} on ${dateStr} at ${nextSession.start_time}.`,
      actionText: "Join Session →",
      actionUrl: `/session/${nextSession.id}`
    }
  } else if (weakTopic) {
    heroState = {
      title: "You identified a topic to improve.",
      description: `Based on your recent assessment, focus on improving: ${weakTopic}.`,
      actionText: `Find a partner for ${weakTopic} →`,
      actionUrl: `/marketplace?q=${encodeURIComponent(weakTopic)}`
    }
  } else if (activeLearningSkill) {
    if (activeLearningSkill.progress_percentage === 0) {
      heroState = {
        title: "Choose a skill to start your journey.",
        description: `Assess your ${activeLearningSkill.skill_name} to see where you stand and earn initial points.`,
        actionText: "Take Assessment →",
        actionUrl: "/assessment"
      }
    } else if (activeLearningSkill.progress_percentage > 0 && activeLearningSkill.progress_percentage < 100) {
      heroState = {
        title: "Continue building this skill.",
        description: `You are making progress in ${activeLearningSkill.skill_name}. Schedule a session to keep growing.`,
        actionText: "Continue learning →",
        actionUrl: "/marketplace"
      }
    } else if (activeLearningSkill.progress_percentage === 100 && !activeLearningSkill.badge) {
      heroState = {
        title: "You're ready for the next milestone.",
        description: `You've completed the learning path for ${activeLearningSkill.skill_name}. Take the final assessment to earn your verified badge.`,
        actionText: "Take final assessment →",
        actionUrl: "/assessment"
      }
    } else if (activeLearningSkill.progress_percentage === 100 && activeLearningSkill.badge) {
      heroState = {
        title: `Skill milestone reached in ${activeLearningSkill.skill_name}.`,
        description: "You hold a verified badge. You can now teach this skill or start learning a new one.",
        actionText: "Discover new skills →",
        actionUrl: "/marketplace"
      }
    }
  }

  const isEmptyState = skills.length === 0 && upcoming.length === 0;

  return (
    <div className="page space-y-4 md:space-y-6 pb-8">
      
      <section className="mb-4">
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
      ) : isEmptyState ? (
        // A7: Dashboard Empty State
        <div className="card p-6 sm:p-8 text-center bg-brand/5 border border-brand/20 shadow-sm mt-6 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-ink mb-2">YOUR JOURNEY STARTS HERE</h2>
          <p className="text-clay mb-5 max-w-md mx-auto text-sm">Choose a skill to assess and discover people who can help you grow.</p>
          <Link to="/assessment" className="btn-primary inline-flex py-2.5 px-6 shadow-sm">
            Assess a skill
          </Link>
        </div>
      ) : (
        <div className="max-w-4xl space-y-6">
          
          {/* A1: HERO / NEXT ACTION */}
          <section className="card bg-surface shadow-sm border border-line p-5 md:p-6">
            <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-3">Your Skill Journey</p>
            <h2 className="text-2xl md:text-3xl font-bold text-ink leading-tight mb-3">
              {heroState.title}
            </h2>
            <p className="text-clay font-medium mb-6 max-w-2xl text-base">{heroState.description}</p>
            <Link to={heroState.actionUrl} className="btn-brand inline-flex text-base py-3 px-8 shadow-sm hover:shadow transition-shadow">
              {heroState.actionText}
            </Link>
          </section>

          {/* A2 & A3: CURRENT LEARNING */}
          {learningSkills.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 px-1">Current Learning</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {learningSkills.map(s => {
                  const narrative = getProgressNarrative(s.progress_percentage, s.badge);
                  return (
                    <div key={s.id} className="card p-5 border border-line shadow-sm hover:shadow-md transition-shadow flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-ink text-lg leading-tight mb-0.5">{s.skill_name}</h4>
                          <p className="text-xs text-clay font-medium capitalize">{s.level} {s.badge && '• Verified'}</p>
                        </div>
                        <span className="text-sm font-bold text-brand bg-brand/10 px-2.5 py-1.5 rounded-md">
                          {s.progress_percentage || 0}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-line/50 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div className="bg-brand h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${s.progress_percentage || 0}%` }} />
                      </div>
                      
                      <p className="text-sm font-semibold text-ink/80 mb-5">{narrative}</p>
                      
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-line/40">
                        <p className="text-xs text-clay font-medium">{s.sessions_completed || 0} sessions completed</p>
                        <Link to="/marketplace" className="text-xs font-semibold text-brand hover:underline flex items-center gap-1">
                          Continue learning <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* A5: UPCOMING SESSION */}
          <section>
            <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 px-1">Upcoming Commitment</h3>
            {nextSession ? (
              <div className="card p-4 border border-brand/20 bg-brand/5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                 <Avatar name={nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name} size="md" className="shrink-0" />
                 <div className="flex-1 min-w-0">
                   <p className="font-bold text-ink text-base capitalize">{nextSession.skill}</p>
                   <p className="text-sm text-clay mt-0.5">With <span className="font-medium text-ink">{nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name}</span></p>
                   <p className="text-xs text-ink/60 font-semibold mt-1">
                     {new Date(nextSession.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {nextSession.start_time}
                   </p>
                 </div>
                 <div className="sm:ml-auto shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                   <Link to={`/session/${nextSession.id}`} className="btn-primary w-full sm:w-auto justify-center text-sm px-6 py-2.5">Join Session</Link>
                 </div>
              </div>
            ) : (
              <div className="card p-6 border border-line border-dashed text-center bg-surface">
                <p className="text-sm text-clay mb-3">You don't have any sessions scheduled right now.</p>
                <Link to="/marketplace" className="btn-secondary text-xs">Find a learning partner</Link>
              </div>
            )}
          </section>

          {/* A4: GROWTH & MILESTONES */}
          <section>
            <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 px-1">Growth</h3>
            <div className="card border border-line bg-surface shadow-sm">
               <div className="flex flex-col md:flex-row md:items-center gap-6">
                 <div className="flex-1">
                   <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">Next Milestone</p>
                   <h4 className="font-bold text-ink text-xl md:text-2xl mb-1">{gamification?.next_milestone_title || "Level Up"}</h4>
                   <div className="flex justify-between items-end mb-3 mt-5">
                     <p className="text-sm text-ink/50 font-semibold">{gamification?.total_points || user.points || 0} / {gamification?.next_milestone_points || 500} points</p>
                   </div>
                   <div className="w-full bg-line/40 h-2.5 rounded-full overflow-hidden">
                     <div 
                       className="bg-gold h-full rounded-full transition-all duration-700 ease-out" 
                       style={{ width: `${Math.min(100, (((gamification?.total_points || user.points || 0) / (gamification?.next_milestone_points || 500)) * 100))}%` }} 
                     />
                   </div>
                 </div>
                 <div className="md:border-l md:border-line/50 md:pl-8 text-center shrink-0">
                   <p className="text-4xl md:text-5xl text-ink font-bold mb-1">{gamification?.total_points || user.points || 0}</p>
                   <p className="text-xs font-bold text-gold uppercase tracking-wider">Total Points</p>
                 </div>
               </div>
            </div>
          </section>

          {/* A6: TEACHING SKILLS */}
          {teachingSkills.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 px-1">Skills You Teach</h3>
              <div className="flex flex-wrap gap-2">
                {teachingSkills.map(s => (
                  <div key={s.id} className="bg-surface border border-line px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm">
                    <span className="font-semibold text-sm text-ink">{s.skill_name}</span>
                    {s.badge && <SkillBadge badge={s.badge} />}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}

function SkillBadge({ badge }) {
  if (!badge) return null
  return (
    <span className="inline-flex items-center gap-1.5 bg-goldLight text-gold px-2 py-1 rounded-md text-[10px] font-bold border border-gold/20 shadow-sm">
      <CheckCircle className="w-3.5 h-3.5 text-brand" /> Verified
    </span>
  )
}
