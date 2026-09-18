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
    title: "Begin Your Journey",
    description: "Take your first Skill Challenge to establish your baseline and unlock your path.",
    actionText: "Start a Skill Challenge",
    actionUrl: "/assessment",
    icon: <Compass className="w-24 h-24 text-brand opacity-20" />
  }

  if (nextSession) {
    const peerName = nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name;
    const dateStr = new Date(nextSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    heroState = {
      title: "Enter the Learning Arena",
      description: `Your training in ${nextSession.skill} with ${peerName} begins on ${dateStr} at ${nextSession.start_time}.`,
      actionText: "Join Arena →",
      actionUrl: `/session/${nextSession.id}`,
      icon: <Calendar className="w-24 h-24 text-brand opacity-20" />
    }
  } else if (weakTopic) {
    heroState = {
      title: "Conquer Your Weak Topics",
      description: `Your recent Skill Challenge revealed an area for growth. Focus your training on: ${weakTopic}.`,
      actionText: `Find a partner for ${weakTopic} →`,
      actionUrl: `/marketplace?q=${encodeURIComponent(weakTopic)}`,
      icon: <Users className="w-24 h-24 text-brand opacity-20" />
    }
  } else if (activeLearningSkill) {
    if (activeLearningSkill.progress_percentage === 0) {
      heroState = {
        title: "Take the Skill Challenge",
        description: `Assess your ${activeLearningSkill.skill_name} to establish your baseline and earn initial XP.`,
        actionText: "Start Challenge →",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`,
        icon: <ClipboardCheck className="w-24 h-24 text-brand opacity-20" />
      }
    } else if (activeLearningSkill.progress_percentage > 0 && activeLearningSkill.progress_percentage < 100) {
      heroState = {
        title: "Train with a Partner",
        description: `Mastery requires practice. Schedule a session in ${activeLearningSkill.skill_name} to keep growing.`,
        actionText: "Find a learning partner →",
        actionUrl: "/marketplace",
        icon: <BookOpen className="w-24 h-24 text-brand opacity-20" />
      }
    } else if (activeLearningSkill.progress_percentage === 100 && !activeLearningSkill.badge) {
      heroState = {
        title: "The Final Challenge Awaits",
        description: `You've completed the learning path for ${activeLearningSkill.skill_name}. Take the final challenge to earn your verified badge.`,
        actionText: "Take Final Challenge →",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`,
        icon: <CheckCircle className="w-24 h-24 text-brand opacity-20" />
      }
    } else if (activeLearningSkill.progress_percentage === 100 && activeLearningSkill.badge) {
      heroState = {
        title: "Mastery Achieved",
        description: `You hold a verified badge in ${activeLearningSkill.skill_name}. You can now guide others or begin a new quest.`,
        actionText: "Start New Quest →",
        actionUrl: "/marketplace",
        icon: <Award className="w-24 h-24 text-brand opacity-20" />
      }
    }
  }

  const isEmptyState = skills.length === 0 && upcoming.length === 0;

  return (
    <div className="page space-y-4 md:space-y-6 pb-8 animate-fade-in stagger-1">
      
      {/* Player Stats Header */}
      <section className="mb-4 bg-surface p-4 rounded-xl border border-line shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" className="shrink-0" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink mb-1">
              {user.name.split(' ')[0]}'s Journey
            </h1>
            <p className="text-sm font-semibold text-brand flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Level: {gamification?.next_milestone_title || "Explorer"}
            </p>
          </div>
        </div>
        <div className="w-full md:w-64">
           <div className="flex justify-between items-end mb-1">
             <p className="text-[10px] font-bold text-clay uppercase tracking-wider">XP to next level</p>
             <p className="text-xs text-ink/70 font-semibold">{gamification?.total_points || user.points || 0} / {gamification?.next_milestone_points || 500}</p>
           </div>
           <div className="w-full bg-line/40 h-2 rounded-full overflow-hidden">
             <div 
               className="bg-brand h-full rounded-full transition-all duration-700 ease-out animate-progress" 
               style={{ width: `${Math.min(100, (((gamification?.total_points || user.points || 0) / (gamification?.next_milestone_points || 500)) * 100))}%` }} 
             />
           </div>
        </div>
      </section>

      {loading ? (
        showLoading ? (
          <div className="skeleton h-48 w-full rounded-2xl mb-8" />
        ) : null
      ) : isEmptyState ? (
        // Start Journey Node
        <div className="card p-8 sm:p-12 text-center bg-brand/5 border border-brand/20 shadow-sm mt-6 max-w-4xl mx-auto animate-slide-up stagger-2 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
          <div className="w-20 h-20 bg-surface border-4 border-brand/20 text-brand rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-sm">
            <Compass className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-3 relative z-10">YOUR FIRST QUEST AWAITS</h2>
          <p className="text-clay mb-8 max-w-md mx-auto text-base relative z-10">Every journey begins with a single step. Choose a skill to assess and discover your path.</p>
          <Link to="/assessment" className="btn-brand inline-flex py-3 px-8 text-base shadow-md hover:shadow-lg transition-all relative z-10">
            Accept Quest: Assess a Skill
          </Link>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-3 lg:gap-10 lg:items-start space-y-8 lg:space-y-0">
          
          <div className="lg:col-span-2 space-y-8">
            <section className="animate-slide-up stagger-2">
              <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
                <Compass className="w-5 h-5 text-brand" /> Current Skill Path
                {activeLearningSkill && <span className="text-sm font-semibold text-clay bg-line/30 px-2 py-0.5 rounded ml-2">{activeLearningSkill.skill_name}</span>}
              </h2>
              
              <div className="relative pl-2 sm:pl-4 ml-2 space-y-10 py-6">
                
                {/* The glowing path line */}
                <div className="absolute left-6 top-8 bottom-8 w-1 bg-gradient-to-b from-brand/80 via-brand/30 to-transparent rounded-full shadow-[0_0_10px_rgba(var(--color-brand),0.3)] z-0" />
                
                {/* Past/Completed Nodes */}
                {activeLearningSkill && activeLearningSkill.progress_percentage > 0 && (
                  <div className="relative flex items-start gap-4 sm:gap-6 z-10">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center">
                      <div className="w-4 h-4 bg-brand rounded-full shadow-[0_0_12px_rgba(var(--color-brand),0.6)] border-2 border-surface" />
                    </div>
                    <div className="pt-1 sm:pt-2">
                      <h3 className="text-sm font-bold text-ink opacity-60">Training Commenced</h3>
                      <p className="text-xs text-clay">You've started your journey in {activeLearningSkill.skill_name}.</p>
                    </div>
                  </div>
                )}

                {/* CURRENT QUEST NODE (Highlight) */}
                <div className="relative flex items-start gap-4 sm:gap-6 group z-10">
                   {/* Ambient Background Glow matching the active node */}
                   <div className="absolute top-1/2 left-0 -translate-y-1/2 w-32 h-32 bg-brand/20 rounded-full blur-3xl pointer-events-none z-0" />
                   
                   <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center relative z-10 pt-1 sm:pt-2">
                     {/* Outer pulsing ring */}
                     <div className="absolute w-8 h-8 bg-brand/30 rounded-full animate-slow-pulse" />
                     {/* Solid current dot */}
                     <div className="w-5 h-5 bg-brand rounded-full border-[3px] border-surface shadow-[0_0_15px_rgba(var(--color-brand),0.8)] relative z-10" />
                   </div>
                   
                   <div className="flex-1 card bg-brand/5 border border-brand/30 shadow-sm p-5 md:p-6 overflow-hidden relative rounded-xl transform transition-transform group-hover:-translate-y-1 z-10">
                     <div className="relative z-10">
                       <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1 flex items-center gap-1.5">
                         <Star className="w-3.5 h-3.5 fill-brand text-brand" /> Current Quest
                       </p>
                       <h3 className="text-xl font-bold text-ink leading-tight mb-2">
                         {heroState.title}
                       </h3>
                       <p className="text-clay font-medium mb-5 text-sm">{heroState.description}</p>
                       <Link to={heroState.actionUrl} className="btn-brand inline-flex text-sm py-2.5 px-6 shadow-sm hover:shadow transition-shadow">
                         {heroState.actionText}
                       </Link>
                     </div>
                     <div className="absolute right-0 bottom-0 top-0 hidden sm:flex items-center justify-end pr-6 pointer-events-none opacity-50">
                       {heroState.icon}
                     </div>
                   </div>
                </div>

                {/* Future Nodes */}
                {(!activeLearningSkill || activeLearningSkill.progress_percentage < 100 || !activeLearningSkill.badge) && (
                  <div className="relative flex items-start gap-4 sm:gap-6 opacity-40 z-10">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center pt-1 sm:pt-2">
                      <div className="w-4 h-4 bg-transparent border-2 border-dashed border-line rounded-full" />
                    </div>
                    <div className="pt-1 sm:pt-2">
                      <h3 className="text-sm font-bold text-ink">Mastery Verification</h3>
                      <p className="text-xs text-clay">Earn your verified badge to teach others.</p>
                    </div>
                  </div>
                )}

              </div>
            </section>
            
            {/* OTHER ACTIVE SKILLS */}
            {learningSkills.filter(s => s.id !== activeLearningSkill?.id).length > 0 && (
              <section className="animate-slide-up stagger-3">
                <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-4 px-1">Other Active Paths</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {learningSkills.filter(s => s.id !== activeLearningSkill?.id).map(s => (
                    <div key={s.id} className="bg-surface border border-line px-4 py-3 rounded-xl flex flex-col gap-2">
                       <div className="flex justify-between items-center">
                         <span className="font-bold text-sm text-ink">{s.skill_name}</span>
                         <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">{s.progress_percentage || 0}%</span>
                       </div>
                       <div className="w-full bg-line/50 rounded-full h-1 overflow-hidden">
                         <div className="bg-brand h-full rounded-full transition-all duration-700 ease-out animate-progress" style={{ width: `${s.progress_percentage || 0}%` }} />
                       </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6 lg:pl-4 animate-slide-up stagger-3">
            {/* INVENTORY / SKILLS TAUGHT */}
            <section>
              <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Mastered Skills
              </h3>
              {teachingSkills.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {teachingSkills.map(s => (
                    <div key={s.id} className="bg-surface border border-gold/20 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-gold/40 transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold/50 group-hover:bg-gold transition-colors" />
                      <span className="font-semibold text-sm text-ink pl-1">{s.skill_name}</span>
                      {s.badge && <SkillBadge badge={s.badge} />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface border border-line border-dashed rounded-xl px-4 py-6 text-center">
                   <Award className="w-6 h-6 text-clay mx-auto mb-2 opacity-50" />
                   <p className="text-xs text-clay">Master a skill to add it to your inventory and teach others.</p>
                </div>
              )}
            </section>
            
            {/* UPCOMING EVENTS */}
            <section>
              <h3 className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Scheduled Events
              </h3>
              {nextSession ? (
                <div className="card p-4 border border-brand/20 bg-brand/5 shadow-sm flex flex-col gap-3">
                   <div className="flex items-center gap-3">
                     <Avatar name={nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name} size="md" className="shrink-0" />
                     <div className="flex-1 min-w-0">
                       <p className="font-bold text-ink text-sm line-clamp-1">{nextSession.skill}</p>
                       <p className="text-xs text-clay">With <span className="font-medium text-ink">{nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name}</span></p>
                     </div>
                   </div>
                   <div className="pt-3 border-t border-brand/10">
                     <p className="text-xs text-ink/70 font-semibold mb-3">
                       {new Date(nextSession.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {nextSession.start_time}
                     </p>
                     <Link to={`/session/${nextSession.id}`} className="btn-primary w-full justify-center text-xs py-2">Enter Session</Link>
                   </div>
                </div>
              ) : (
                <div className="bg-surface border border-line border-dashed rounded-xl px-4 py-5 text-center">
                  <p className="text-xs text-clay mb-3">No upcoming events.</p>
                  <Link to="/marketplace" className="text-xs font-semibold text-brand hover:underline">Find a partner →</Link>
                </div>
              )}
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
    <span className="inline-flex items-center gap-1.5 bg-goldLight text-gold px-2 py-1 rounded-md text-[10px] font-bold border border-gold/20 shadow-sm">
      <CheckCircle className="w-3.5 h-3.5 text-brand" /> Verified
    </span>
  )
}
