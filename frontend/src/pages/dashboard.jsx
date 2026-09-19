import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Trophy, CheckCircle, ClipboardCheck, Award, Users, Star, BookOpen, Compass, Calendar, MapPin, Zap } from 'lucide-react'
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
  const [outRequests, setOutRequests] = useState([])

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
          gamiData,
          outReqData,
          latestAssessmentData
        ] = await Promise.all([
          api.getMyProgress().catch(() => []),
          api.upcomingSessions().catch(() => []),
          api.getGamificationSummary().catch(() => null),
          api.outgoingRequests().catch(() => []),
          api.getLatestAssessment().catch(() => null)
        ])

        if (!isMounted) return;

        setSkills(skillsData || [])
        setUpcoming(upcomingData || [])
        setGamification(gamiData)
        setOutRequests(outReqData || [])

        if (!topic && latestAssessmentData && latestAssessmentData.weak_topics) {
          const topicsArray = latestAssessmentData.weak_topics.split(',').map(t => t.trim()).filter(Boolean);
          if (topicsArray.length > 0) {
            setWeakTopic(topicsArray[0]);
          }
        }

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
  const activeLearningSkill = learningSkills.length > 0
    ? learningSkills.reduce((prev, current) => (prev.progress_percentage > current.progress_percentage) ? prev : current)
    : null

  // ─── Journey Decision Logic (A1 — exact, unchanged) ───────────────────────
  let heroState = {
    title: "Begin Your Journey",
    description: "Take your first Skill Challenge to establish your baseline and unlock your path.",
    actionText: "Start a Skill Challenge",
    actionUrl: "/assessment",
    icon: <Compass className="w-24 h-24 text-brand" />
  }

  if (nextSession) {
    const peerName = nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name;
    const dateStr = new Date(nextSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    heroState = {
      title: "Enter the Learning Arena",
      description: `Your upcoming session is confirmed. Prepare to learn and practice.`,
      actionText: "Join Arena →",
      actionUrl: `/session/${nextSession.id}`,
      icon: <Calendar className="w-24 h-24 text-brand" />,
      metadata: [
        { label: "Partner", value: peerName },
        { label: "Focus Skill", value: nextSession.skill },
        { label: "Date", value: dateStr },
        { label: "Time", value: nextSession.start_time }
      ]
    }
  } else if (weakTopic) {
    heroState = {
      title: "Conquer Your Weak Topics",
      description: `Your recent Skill Challenge revealed an area for growth. Focus your training on: ${weakTopic}.`,
      actionText: `Find a partner for ${weakTopic} →`,
      actionUrl: `/marketplace?q=${encodeURIComponent(weakTopic)}`,
      icon: <Users className="w-24 h-24 text-brand" />
    }
  } else if (activeLearningSkill) {
    if (activeLearningSkill.progress_percentage === 0) {
      heroState = {
        title: "Take the Skill Challenge",
        description: `Assess your ${activeLearningSkill.skill_name} to establish your baseline and earn initial XP.`,
        actionText: "Start Challenge →",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`,
        icon: <ClipboardCheck className="w-24 h-24 text-brand" />
      }
    } else if (activeLearningSkill.progress_percentage > 0 && activeLearningSkill.progress_percentage < 100) {
      const relevantRequest = outRequests.find(r => r.skill_name === activeLearningSkill.skill_name && (r.status === 'pending' || r.status === 'accepted'))
      if (relevantRequest) {
        if (relevantRequest.status === 'pending') {
          heroState = {
            title: "Connection Pending",
            description: `Your request to learn ${activeLearningSkill.skill_name} is awaiting response. Check your requests.`,
            actionText: "View Requests →",
            actionUrl: "/requests",
            icon: <Users className="w-24 h-24 text-brand" />
          }
        } else if (relevantRequest.status === 'accepted') {
          heroState = {
            title: "Prepare for Learning",
            description: `Coordinate and schedule a session with your partner to continue your journey.`,
            actionText: "Message Partner →",
            actionUrl: `/messages?request_id=${relevantRequest.id}`,
            icon: <BookOpen className="w-24 h-24 text-brand" />,
            metadata: [
              { label: "Partner", value: relevantRequest.to_user_name },
              { label: "Focus Skill", value: activeLearningSkill.skill_name },
              { label: "Recommended Topic", value: weakTopic || "General Practice" },
              { label: "Status", value: "Waiting to schedule" }
            ]
          }
        }
      } else {
        heroState = {
          title: "Train with a Partner",
          description: `Mastery requires practice. Schedule a session in ${activeLearningSkill.skill_name} to keep growing.`,
          actionText: "Find a learning partner →",
          actionUrl: "/marketplace",
          icon: <BookOpen className="w-24 h-24 text-brand" />
        }
      }
    } else if (activeLearningSkill.progress_percentage === 100 && !activeLearningSkill.badge) {
      heroState = {
        title: "The Final Challenge Awaits",
        description: `You've completed the learning path for ${activeLearningSkill.skill_name}. Take the final challenge to earn your verified badge.`,
        actionText: "Take Final Challenge →",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`,
        icon: <CheckCircle className="w-24 h-24 text-brand" />
      }
    } else if (activeLearningSkill.progress_percentage === 100 && activeLearningSkill.badge) {
      heroState = {
        title: "Mastery Achieved",
        description: `You hold a verified badge in ${activeLearningSkill.skill_name}. You can now guide others or begin a new quest.`,
        actionText: "Start New Quest →",
        actionUrl: "/marketplace",
        icon: <Award className="w-24 h-24 text-brand" />
      }
    }
  }

  const isEmptyState = skills.length === 0 && upcoming.length === 0;

  // XP progress percentage
  const totalPts = gamification?.total_points || user.points || 0;
  const nextPts  = gamification?.next_milestone_points || 500;
  const xpPct    = Math.min(100, (totalPts / nextPts) * 100);

  // Time-of-day greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen pb-24 xl:pb-10 animate-fade-in stagger-1">

      {/* ═══════════════════════════════════════════════════════════
          HERO BAND — Immersive welcome, full-width, no hard card
          ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 md:pt-8 mb-10">
        <div className="relative rounded-[2.5rem] overflow-hidden">

          {/* Hero atmospheric layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-brandLight/70 via-surface/50 to-lift/60" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_0%_0%,_rgba(67,56,202,0.10)_0%,_transparent_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_100%,_rgba(6,182,212,0.06)_0%,_transparent_70%)]" />
          <div className="absolute -top-8 -right-8 w-48 h-48 bg-brand2/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/6 rounded-full blur-2xl" />

          <div className="relative z-10 p-6 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">

              {/* Left — Avatar + Identity */}
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-brand/15 rounded-full blur-lg scale-110" />
                  <Avatar
                    name={user.name}
                    size="lg"
                    className="relative z-10 ring-4 ring-white/70 shadow-lg"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-brand/60 uppercase tracking-[0.18em] mb-1 select-none">
                    {timeGreeting}
                  </p>
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-ink leading-none mb-2 truncate">
                    {user.name.split(' ')[0]}
                  </h1>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand bg-brand/10 border border-brand/20 px-2.5 py-1 rounded-full select-none">
                      <Award className="w-3 h-3" />
                      {gamification?.next_milestone_title || 'Explorer'}
                    </span>
                    <span className="text-xs text-clay font-mono select-none">
                      {totalPts} <span className="opacity-50">pts</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right — State indicators + XP */}
              <div className="flex flex-col gap-4 w-full sm:w-auto sm:min-w-[200px] sm:items-end">

                {/* Current skill state chips */}
                {activeLearningSkill && (
                  <div className="flex flex-col gap-1 sm:text-right">
                    <p className="text-[9px] font-bold text-clay/70 uppercase tracking-[0.15em]">Currently Exploring</p>
                    <p className="text-base font-bold text-ink leading-tight">{activeLearningSkill.skill_name}</p>
                    {weakTopic && (
                      <>
                        <p className="text-[9px] font-bold text-clay/70 uppercase tracking-[0.15em] mt-1">Current Focus</p>
                        <p className="text-sm font-semibold text-brand2 leading-tight">{weakTopic}</p>
                      </>
                    )}
                    <p className="text-[10px] text-clay mt-0.5 italic">
                      {getProgressNarrative(activeLearningSkill.progress_percentage, activeLearningSkill.badge)}
                    </p>
                  </div>
                )}

                {/* XP bar */}
                <div className="w-full sm:w-48">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[9px] font-bold text-clay/70 uppercase tracking-[0.12em]">XP to next level</p>
                    <p className="text-[10px] font-bold text-ink font-mono">{totalPts}/{nextPts}</p>
                  </div>
                  <div className="w-full bg-line/30 h-[5px] rounded-full overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-brand to-brand2 h-full rounded-full animate-progress relative"
                      style={{ width: `${xpPct}%` }}
                    >
                      <div className="absolute top-0 bottom-0 right-0 w-3 bg-white/30 blur-[2px] -skew-x-12" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          LOADING / EMPTY / MAIN CONTENT
          ═══════════════════════════════════════════════════════════ */}
      {loading ? (
        showLoading ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="skeleton h-56 w-full rounded-3xl" />
            <div className="grid grid-cols-3 gap-4">
              <div className="skeleton col-span-2 h-32 rounded-2xl" />
              <div className="skeleton h-32 rounded-2xl" />
            </div>
          </div>
        ) : null

      ) : isEmptyState ? (
        /* ─── EMPTY STATE — Universe Awakens ─── */
        <div className="max-w-6xl mx-auto px-4 sm:px-6 animate-slide-up stagger-2">
          <div className="relative rounded-[2.5rem] overflow-hidden p-10 sm:p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-brandLight/50 via-surface/60 to-lift/70" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand/6 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand2/4 rounded-full blur-2xl pointer-events-none" />

            {/* Orbit rings */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <ellipse cx="50%" cy="50%" rx="45%" ry="35%" stroke="rgb(67,56,202)" strokeWidth="1" fill="none" strokeDasharray="6 10" />
              <ellipse cx="50%" cy="50%" rx="30%" ry="22%" stroke="rgb(124,58,237)" strokeWidth="1" fill="none" strokeDasharray="4 8" />
            </svg>

            <div className="relative z-10">
              <div className="w-20 h-20 bg-surface border-4 border-brand/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(67,56,202,0.25)]">
                <Compass className="w-10 h-10 text-brand" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink mb-3">Your First Quest Awaits</h2>
              <p className="text-clay mb-8 max-w-md mx-auto text-base leading-relaxed">
                Every journey begins with a single step. Choose a skill to assess and discover your personal learning path.
              </p>
              <Link to="/assessment" className="btn-brand inline-flex py-3.5 px-10 text-base shadow-[0_8px_24px_rgba(67,56,202,0.25)]">
                Accept Quest: Assess a Skill
              </Link>
            </div>
          </div>
        </div>

      ) : (
        /* ─── MAIN LAYOUT: Journey + Sidebar ─── */
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_290px] lg:gap-14 lg:items-start space-y-10 lg:space-y-0">

          {/* ══════════════════════════════════════════
              LEFT COL — SKILL JOURNEY (visual center)
              ══════════════════════════════════════════ */}
          <section className="animate-slide-up stagger-2">

            {/* Section label */}
            <div className="flex items-center gap-3 mb-9">
              <div className="flex-1 h-px bg-gradient-to-r from-brand/25 to-transparent" />
              <h2 className="flex items-center gap-1.5 text-[10px] font-bold text-clay uppercase tracking-[0.15em] shrink-0">
                <MapPin className="w-3 h-3 text-brand" />
                Skill Journey
                {activeLearningSkill && (
                  <span className="text-brand ml-1 normal-case font-semibold text-[11px]">
                    — {activeLearningSkill.skill_name}
                  </span>
                )}
              </h2>
              <div className="flex-1 h-px bg-gradient-to-l from-brand/25 to-transparent" />
            </div>

            {/* The path container */}
            <div className="relative">

              {/* ─── JOURNEY PATH LINE ─── */}
              <div
                className="absolute left-[15px] top-5 bottom-5 w-[2px] rounded-full"
                style={{
                  background: 'linear-gradient(to bottom, rgb(124,58,237) 0%, rgba(67,56,202,0.5) 40%, rgba(6,182,212,0.2) 80%, rgba(245,158,11,0.15) 100%)',
                  boxShadow: '0 0 10px rgba(67,56,202,0.25)',
                }}
              />

              <div className="space-y-0">

                {/* NODE A: Journey Started (visible only when progress > 0) */}
                {activeLearningSkill && activeLearningSkill.progress_percentage > 0 && (
                  <div className="relative flex items-center gap-5 pb-7 z-10">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                      <div
                        className="w-[14px] h-[14px] rounded-full border-2 border-surface"
                        style={{ background: 'rgb(124,58,237)', boxShadow: '0 0 10px rgba(124,58,237,0.5)' }}
                      />
                    </div>
                    <div className="opacity-55">
                      <p className="text-sm font-bold text-ink">Training Commenced</p>
                      <p className="text-xs text-clay">
                        You've started your journey in <span className="font-medium">{activeLearningSkill.skill_name}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* NODE B: CURRENT QUEST — The Dominant Active Zone */}
                <div className="relative flex items-start gap-5 pb-7 group z-10">

                  {/* Active node indicator */}
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center mt-4 relative">
                    <div className="absolute w-11 h-11 bg-brand/12 rounded-full animate-slow-pulse" />
                    <div
                      className="relative z-10 w-[26px] h-[26px] bg-surface rounded-full flex items-center justify-center"
                      style={{ border: '3px solid rgb(67,56,202)', boxShadow: '0 0 18px rgba(67,56,202,0.4)' }}
                    >
                      <div className="w-2.5 h-2.5 bg-brand rounded-full" />
                    </div>
                  </div>

                  {/* ─── QUEST GLASS REGION ─── */}
                  <div
                    className="flex-1 relative rounded-[2rem] overflow-hidden transition-all duration-500 group-hover:shadow-[0_16px_48px_rgba(67,56,202,0.10)]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(236,238,255,0.75) 0%, rgba(255,255,255,0.55) 50%, rgba(244,244,250,0.65) 100%)',
                      backdropFilter: 'blur(28px)',
                      WebkitBackdropFilter: 'blur(28px)',
                      border: '1px solid rgba(67,56,202,0.13)',
                    }}
                  >
                    {/* Inner ambient glow — brightens on hover */}
                    <div className="absolute top-0 left-0 w-56 h-56 bg-brand/7 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-accent/5 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="relative z-10 p-6 md:p-8">

                      {/* Eyebrow label */}
                      <p className="text-[10px] font-bold text-brand uppercase tracking-widest mb-2.5 flex items-center gap-1.5 select-none">
                        <Star className="w-3.5 h-3.5 fill-brand" />
                        Your Next Move
                      </p>

                      {/* Quest title */}
                      <h3 className="text-2xl md:text-[1.8rem] font-display font-bold text-ink leading-tight mb-3">
                        {heroState.title}
                      </h3>

                      {/* Quest description */}
                      <p className="text-clay font-medium mb-6 text-sm md:text-base max-w-lg leading-relaxed">
                        {heroState.description}
                      </p>

                      {/* Metadata grid */}
                      {heroState.metadata && (
                        <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 mb-7 max-w-sm">
                          {heroState.metadata.map(m => (
                            <div key={m.label}>
                              <span className="text-clay uppercase tracking-wider text-[9px] font-bold block mb-0.5 select-none">
                                {m.label}
                              </span>
                              <span className="text-ink font-bold text-sm">{m.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CTA */}
                      <Link
                        to={heroState.actionUrl}
                        className="btn-brand text-sm px-7 py-3 rounded-full shadow-[0_8px_24px_rgba(67,56,202,0.22)] inline-flex hover:shadow-[0_12px_32px_rgba(67,56,202,0.32)] transition-shadow"
                      >
                        {heroState.actionText}
                      </Link>
                    </div>

                    {/* Watermark icon */}
                    <div className="absolute right-3 bottom-3 pointer-events-none opacity-[0.035] group-hover:opacity-[0.06] transition-opacity duration-700">
                      <div className="scale-150 origin-bottom-right">
                        {heroState.icon}
                      </div>
                    </div>
                  </div>
                </div>

                {/* NODE C: Mastery Verification (future node) */}
                {(!activeLearningSkill || activeLearningSkill.progress_percentage < 100 || !activeLearningSkill.badge) && (
                  <div className="relative flex items-center gap-5 opacity-30 z-10">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                      <div className="w-[14px] h-[14px] rounded-full border-2 border-dashed border-gold/60 bg-transparent" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-clay">Mastery Verification</p>
                      <p className="text-xs text-clay/60">Earn your verified badge to teach others</p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ─── OTHER ACTIVE LEARNING PATHS ─── */}
            {learningSkills.filter(s => s.id !== activeLearningSkill?.id).length > 0 && (
              <div className="mt-10 animate-slide-up stagger-3">
                <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-4">Other Active Paths</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {learningSkills.filter(s => s.id !== activeLearningSkill?.id).map(s => (
                    <div
                      key={s.id}
                      className="bg-surface/50 backdrop-blur-lg border border-line/20 px-4 py-3 rounded-xl flex flex-col gap-2 hover:border-brand/25 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-ink">{s.skill_name}</span>
                        <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">
                          {s.progress_percentage || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-line/20 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-brand2 to-brand h-full rounded-full animate-progress"
                          style={{ width: `${s.progress_percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ══════════════════════════════════════════
              RIGHT COL — LEARNING STATE PANEL
              ══════════════════════════════════════════ */}
          <aside className="space-y-8 animate-slide-up stagger-3">

            {/* ─── MASTERED SKILLS ─── */}
            <div>
              <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-gold" />
                Mastered
              </p>
              {teachingSkills.length > 0 ? (
                <div className="space-y-2">
                  {teachingSkills.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface/50 backdrop-blur-sm border-l-2 border-gold/45 hover:bg-surface/80 transition-colors group"
                    >
                      <span className="font-semibold text-sm text-ink group-hover:text-ink/90">{s.skill_name}</span>
                      {s.badge && <SkillBadge badge={s.badge} />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line/35 px-4 py-6 text-center">
                  <Award className="w-5 h-5 text-clay/35 mx-auto mb-2" />
                  <p className="text-xs text-clay leading-relaxed">
                    Complete a skill path to add it to your inventory.
                  </p>
                </div>
              )}
            </div>

            {/* ─── DIVIDER ─── */}
            <div className="h-px bg-gradient-to-r from-transparent via-line/40 to-transparent" />

            {/* ─── COMING UP ─── */}
            <div>
              <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Coming Up
              </p>
              {nextSession ? (
                <div
                  className="rounded-2xl p-4 space-y-3"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(232,233,241,0.6)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink text-sm line-clamp-1">{nextSession.skill}</p>
                      <p className="text-xs text-clay">
                        With{' '}
                        <span className="font-medium text-ink">
                          {nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-line/15">
                    <p className="text-xs text-ink/60 font-semibold mb-2.5">
                      {new Date(nextSession.session_date).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric'
                      })} • {nextSession.start_time}
                    </p>
                    <Link to={`/session/${nextSession.id}`} className="btn-primary w-full justify-center text-xs py-2">
                      Enter Session
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line/35 px-4 py-5 text-center">
                  <p className="text-xs text-clay mb-2">No upcoming learning arena.</p>
                  <Link to="/marketplace" className="text-xs font-semibold text-brand hover:underline">
                    Find a partner →
                  </Link>
                </div>
              )}
            </div>

            {/* ─── DIVIDER ─── */}
            {(teachingSkills.length > 0 || nextSession) && (
              <div className="h-px bg-gradient-to-r from-transparent via-line/40 to-transparent" />
            )}

            {/* ─── QUICK LINKS ─── */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Quick Actions
              </p>
              {[
                { to: '/marketplace', label: 'Discover Partners' },
                { to: '/assessment',  label: 'Take a Skill Challenge' },
                { to: '/gamification', label: 'View Full Journey' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-clay hover:text-brand hover:bg-brand/6 transition-all duration-200 group"
                >
                  <span>{label}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-brand text-base leading-none">→</span>
                </Link>
              ))}
            </div>

          </aside>

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
