import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Trophy, CheckCircle, ClipboardCheck, Award,
  Users, Star, BookOpen, Compass, Calendar,
  MapPin, Zap, ArrowDown, ChevronRight, Play
} from 'lucide-react'
import { api, getSessionUser } from '../api'
import Avatar from '../components/ui/Avatar'
import { HeroIllustration, EmptyStateIllustration } from '../components/illustrations'
import { GradientOrb, DecorativeGrid } from '../components/visuals'
import { AchievementBadge } from '../components/badges'
import { FadeIn, Reveal, StaggerContainer, StaggerItem } from '../components/animations'

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
  const [outRequests, setOutRequests] = useState([])

  useEffect(() => {
    if (!user) { navigate('/login'); return }

    const searchParams = new URLSearchParams(location.search)
    const topic = searchParams.get('weakTopic')
    if (topic) setWeakTopic(topic)

    let isMounted = true
    const loadingTimer = setTimeout(() => { if (isMounted) setShowLoading(true) }, 150)

    async function fetchDashboardData() {
      try {
        const [skillsData, upcomingData, gamiData, outReqData, latestAssessmentData] = await Promise.all([
          api.getMyProgress().catch(() => []),
          api.upcomingSessions().catch(() => []),
          api.getGamificationSummary().catch(() => null),
          api.outgoingRequests().catch(() => []),
          api.getLatestAssessment().catch(() => null)
        ])
        if (!isMounted) return
        setSkills(skillsData || [])
        setUpcoming(upcomingData || [])
        setGamification(gamiData)
        setOutRequests(outReqData || [])
        if (!topic && latestAssessmentData?.weak_topics) {
          const arr = latestAssessmentData.weak_topics.split(',').map(t => t.trim()).filter(Boolean)
          if (arr.length > 0) setWeakTopic(arr[0])
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err)
      } finally {
        if (isMounted) { clearTimeout(loadingTimer); setLoading(false); setShowLoading(false) }
      }
    }
    fetchDashboardData()
    return () => { isMounted = false; clearTimeout(loadingTimer) }
  }, [user, navigate, location.search])

  if (!user) return null

  const learningSkills = skills.filter(s => s.role === 'learning')
  const teachingSkills = skills.filter(s => s.role === 'teaching')
  const nextSession = upcoming.length > 0 ? upcoming[0] : null
  const activeLearningSkill = learningSkills.length > 0
    ? learningSkills.reduce((prev, cur) => (prev.progress_percentage > cur.progress_percentage) ? prev : cur)
    : null

  let heroState = {
    title: "Begin Your Journey",
    description: "Take your first Skill Challenge to establish your baseline and unlock your path.",
    actionText: "Start a Skill Challenge",
    actionUrl: "/assessment"
  }

  if (nextSession) {
    const peerName = nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name
    const dateStr = new Date(nextSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    heroState = {
      title: "Enter the Learning Arena",
      description: `Your upcoming session is confirmed. Prepare to learn and practice.`,
      actionText: "Join Arena",
      actionUrl: `/session/${nextSession.id}`
    }
  } else if (weakTopic) {
    heroState = {
      title: "Conquer Your Weak Topics",
      description: `Your recent challenge revealed an area for growth. Focus your training on: ${weakTopic}.`,
      actionText: `Find a partner for ${weakTopic}`,
      actionUrl: `/marketplace?q=${encodeURIComponent(weakTopic)}`
    }
  } else if (activeLearningSkill) {
    if (activeLearningSkill.stage === "Discovered") {
      heroState = {
        title: "Take the Skill Challenge",
        description: `Assess your ${activeLearningSkill.skill_name} to establish your baseline and earn initial XP.`,
        actionText: "Start Challenge",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`
      }
    } else if (activeLearningSkill.stage === "Baseline Established" || activeLearningSkill.stage === "Practicing") {
      const relevantRequest = outRequests.find(r =>
        r.skill_name === activeLearningSkill.skill_name &&
        (r.status === 'pending' || r.status === 'accepted')
      )
      if (relevantRequest) {
        if (relevantRequest.status === 'pending') {
          heroState = {
            title: "Connection Pending",
            description: `Your request to learn ${activeLearningSkill.skill_name} is awaiting response.`,
            actionText: "View Requests",
            actionUrl: "/requests"
          }
        } else {
          heroState = {
            title: "Prepare for Learning",
            description: "Coordinate and schedule a session with your partner to continue your journey.",
            actionText: "Message Partner",
            actionUrl: `/messages?request_id=${relevantRequest.id}`
          }
        }
      } else {
        heroState = {
          title: "Train with a Partner",
          description: `Mastery requires practice. Schedule a session in ${activeLearningSkill.skill_name} to keep growing.`,
          actionText: "Find a partner",
          actionUrl: "/marketplace"
        }
      }
    } else if (activeLearningSkill.stage === "Developing") {
      heroState = {
        title: "The Final Challenge Awaits",
        description: `You've completed the learning path for ${activeLearningSkill.skill_name}. Take the final challenge to earn your verified badge.`,
        actionText: "Take Final Challenge",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`
      }
    } else if (activeLearningSkill.stage === "Mastery") {
      heroState = {
        title: "Mastery Achieved",
        description: `You hold a verified badge in ${activeLearningSkill.skill_name}. You can now guide others or begin a new quest.`,
        actionText: "Start New Quest",
        actionUrl: "/marketplace"
      }
    }
  }

  const isEmptyState = skills.length === 0 && upcoming.length === 0
  
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-paper font-body text-ink pb-24 relative overflow-hidden">
      <DecorativeGrid className="opacity-40" />
      <GradientOrb color="bg-brand" size="w-[500px] h-[500px]" className="-top-40 -right-20" opacity="opacity-20" />
      <GradientOrb color="bg-brand2" size="w-[600px] h-[600px]" className="-left-60 top-40" opacity="opacity-[0.15]" blur="blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        
        {loading ? (
          showLoading && (
            <div className="space-y-8 animate-fade-in">
              <div className="skeleton h-[350px] w-full rounded-3xl" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="skeleton lg:col-span-2 h-64 rounded-2xl" />
                <div className="skeleton h-64 rounded-2xl" />
              </div>
            </div>
          )
        ) : (
          <StaggerContainer staggerDelay={0.15} className="space-y-8">
            {/* HERO SECTION */}
            <StaggerItem>
              <div className="relative rounded-3xl bg-surface border border-line overflow-hidden shadow-xl shadow-brand/5">
                <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-brand2/5"></div>
                <div className="relative p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center gap-10">
                  <div className="flex-1 text-center md:text-left z-10">
                    <Reveal duration={0.6}>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand font-bold text-xs uppercase tracking-wider mb-6">
                        <Star className="w-3.5 h-3.5" />
                        {gamification?.next_milestone_title || 'Explorer'} Level
                      </div>
                      <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-ink mb-4 leading-tight">
                        {timeGreeting}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand2">{user.name.split(' ')[0]}</span>.
                      </h1>
                      <div className="p-6 mt-8 bg-paper/50 backdrop-blur-md rounded-2xl border border-line/50 shadow-inner">
                        <h2 className="text-xl md:text-2xl font-bold mb-2 text-ink">{heroState.title}</h2>
                        <p className="text-clay text-base max-w-lg mx-auto md:mx-0 mb-6">{heroState.description}</p>
                        <Link to={heroState.actionUrl} className="btn-primary py-3 px-8 text-base shadow-lg shadow-brand/25 inline-flex items-center gap-2 group">
                          {heroState.actionText}
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </Reveal>
                  </div>
                  <div className="hidden md:flex flex-1 justify-center relative">
                    <HeroIllustration className="w-[120%] max-w-[450px]" />
                  </div>
                </div>
              </div>
            </StaggerItem>

            {isEmptyState ? (
              <StaggerItem>
                <div className="card text-center py-16 border-dashed border-line">
                  <EmptyStateIllustration message="Your journey is just beginning" secondaryMessage="Head over to the marketplace to discover skills and partners to train with." />
                  <Link to="/marketplace" className="btn-brand mt-6">Explore Marketplace</Link>
                </div>
              </StaggerItem>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT: LEARNING PATHS */}
                <div className="lg:col-span-2 space-y-8">
                  <StaggerItem>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-display font-bold text-ink">Learning Paths</h3>
                      <Link to="/gamification" className="text-sm font-semibold text-brand hover:underline">View All</Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningSkills.length === 0 ? (
                        <div className="md:col-span-2 card p-8 text-center bg-surface border-line">
                          <p className="text-clay font-medium mb-4">No active learning paths yet.</p>
                          <Link to="/marketplace" className="btn-secondary">Find a Skill to Learn</Link>
                        </div>
                      ) : (
                        learningSkills.map((s, idx) => (
                          <div key={s.id} className="card p-6 bg-surface border-line hover:border-brand/30 hover:shadow-lg transition-all duration-300 group">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="text-lg font-bold text-ink mb-1 group-hover:text-brand transition-colors">{s.skill_name}</h4>
                                <span className="text-xs font-semibold text-brand bg-brand/10 px-2 py-1 rounded">{s.stage}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-2xl font-bold text-ink">{s.progress_percentage || 0}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-line/30 rounded-full h-2 mb-4 overflow-hidden relative">
                              <div className="absolute inset-0 bg-gradient-to-r from-brand2 to-brand rounded-full transition-all duration-1000 ease-out" style={{ width: `${s.progress_percentage || 0}%` }} />
                            </div>
                            <p className="text-xs text-clay italic line-clamp-2">{s.what_happened || 'Begin your training to see updates here.'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </StaggerItem>

                  {/* BOTTOM: ACHIEVEMENTS */}
                  <StaggerItem>
                    <div className="flex items-center justify-between mb-4 mt-4">
                      <h3 className="text-2xl font-display font-bold text-ink">Verified Badges</h3>
                    </div>
                    <div className="card p-8 bg-surface border-line">
                      <div className="flex flex-wrap gap-6 items-center justify-start">
                        {teachingSkills.length === 0 ? (
                          <div className="text-center w-full py-4">
                            <EmptyStateIllustration message="No badges yet" secondaryMessage="Complete final challenges in your learning paths to earn badges." />
                          </div>
                        ) : (
                          teachingSkills.map((s, i) => {
                            // Using the new Badge component (we randomly assign variant based on index for demo, or match logic)
                            const variants = ['skillMaster', 'mentor', 'fastLearner', 'explorer'];
                            const varId = variants[i % variants.length];
                            return (
                              <div key={s.id} className="flex flex-col items-center">
                                <AchievementBadge variantId={varId} state={i === 0 ? 'new' : 'unlocked'} size="md" />
                                <span className="text-xs font-bold mt-2 text-ink/70">{s.skill_name}</span>
                              </div>
                            )
                          })
                        )}
                        {/* Always show a locked badge as a teaser */}
                        <div className="flex flex-col items-center opacity-70">
                          <AchievementBadge variantId="communityBuilder" state="locked" size="md" />
                          <span className="text-xs font-bold mt-2 text-clay">Locked</span>
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                </div>

                {/* RIGHT: UPCOMING & QUICK ACTIONS */}
                <div className="space-y-6">
                  <StaggerItem>
                    <div className="card p-0 overflow-hidden bg-surface border-line">
                      <div className="bg-brand/5 p-4 border-b border-line/50 flex items-center justify-between">
                        <h4 className="font-bold text-ink uppercase tracking-wider text-xs">Upcoming Session</h4>
                        <Calendar className="w-4 h-4 text-brand" />
                      </div>
                      <div className="p-6">
                        {nextSession ? (
                          <div className="space-y-5">
                            <div className="flex items-center gap-4">
                              <Avatar name={nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name} size="md" className="ring-2 ring-line" />
                              <div>
                                <p className="font-bold text-ink">{nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name}</p>
                                <p className="text-xs font-semibold text-brand bg-brand/10 inline-block px-2 py-0.5 rounded mt-1">{nextSession.skill}</p>
                              </div>
                            </div>
                            <div className="bg-paper rounded-lg p-3 border border-line">
                              <p className="text-sm font-semibold text-ink">
                                {new Date(nextSession.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs text-clay mt-0.5">{nextSession.start_time}</p>
                            </div>
                            <Link to={`/session/${nextSession.id}`} className="btn-primary w-full flex justify-center py-2.5 shadow-md shadow-brand/20">
                              <Play className="w-4 h-4 mr-2" /> Enter Arena
                            </Link>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <Calendar className="w-10 h-10 text-clay/30 mx-auto mb-3" />
                            <p className="text-sm text-clay font-medium mb-4">You have no upcoming sessions scheduled.</p>
                            <Link to="/marketplace" className="text-sm font-bold text-brand hover:underline">Find a partner →</Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </StaggerItem>

                  <StaggerItem>
                    <div className="card bg-surface border-line p-6">
                      <h4 className="font-bold text-ink uppercase tracking-wider text-xs mb-4">Quick Links</h4>
                      <div className="space-y-2">
                        {[
                          { to: '/marketplace',  label: 'Discover Partners', icon: Users },
                          { to: '/assessment',   label: 'Take a Skill Challenge', icon: ClipboardCheck },
                          { to: '/gamification', label: 'View Full Journey', icon: Compass },
                        ].map(({ to, label, icon: Icon }) => (
                          <Link
                            key={to}
                            to={to}
                            className="flex items-center p-3 rounded-xl hover:bg-lift transition-colors group border border-transparent hover:border-line"
                          >
                            <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-clay group-hover:text-ink">{label}</span>
                            <ChevronRight className="w-4 h-4 ml-auto text-clay opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </StaggerItem>

                  <StaggerItem>
                    <div className="card bg-brandLight/40 border-line/50 p-6 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 text-brand opacity-10">
                        <BookOpen className="w-24 h-24" />
                      </div>
                      <h4 className="font-bold text-brand uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1.5">
                        <Star className="w-3 h-3" /> SkillVerse Insight
                      </h4>
                      <p className="text-sm text-ink/80 font-medium leading-relaxed relative z-10 italic">
                        "Teaching a concept can reveal what you truly understand. Share your knowledge to solidify it."
                      </p>
                    </div>
                  </StaggerItem>
                </div>
              </div>
            )}
          </StaggerContainer>
        )}
      </div>
    </div>
  )
}
