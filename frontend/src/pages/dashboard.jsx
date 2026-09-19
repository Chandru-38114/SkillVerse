import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Trophy, CheckCircle, ClipboardCheck, Award,
  Users, Star, BookOpen, Compass, Calendar,
  MapPin, Zap, ArrowDown
} from 'lucide-react'
import { api, getSessionUser } from '../api'
import Avatar from '../components/ui/Avatar'
import SkillBadge from '../components/skillbadge'

/* ─── Journey path SVG (curved, state-aware) ─── */
function JourneyPathSVG({ nodeCount, activeIndex }) {
  // Generates a gentle S-curve path between N nodes
  // The path is rendered as a background SVG behind the nodes
  // nodeCount: total visible nodes
  // activeIndex: which node index is currently active (0-based)
  const height = 100; // percentage-based viewBox
  const pathPoints = [];
  for (let i = 0; i < nodeCount; i++) {
    // Alternate slight left/right offset for S-curve feel
    const xOffset = i % 2 === 0 ? 50 : 54;
    pathPoints.push({ x: xOffset, y: (i / Math.max(nodeCount - 1, 1)) * 100 });
  }

  const d = pathPoints.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pathPoints[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return acc + ` C ${cpx} ${prev.y} ${cpx} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');

  return (
    <svg
      className="absolute left-0 top-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="jpCompleted" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgb(124,58,237)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(67,56,202)"  stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="jpPending" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgb(67,56,202)"  stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(245,158,11)" stopOpacity="0.06" />
        </linearGradient>
        <filter id="jpGlow">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Full path — pending/future portion */}
      <path d={d} fill="none" stroke="url(#jpPending)" strokeWidth="0.8"
        strokeDasharray="2 3" strokeLinecap="round" />

      {/* Completed portion — solid, glowing */}
      {activeIndex > 0 && (() => {
        const completedPts = pathPoints.slice(0, activeIndex + 1);
        const cd = completedPts.reduce((acc, pt, i) => {
          if (i === 0) return `M ${pt.x} ${pt.y}`;
          const prev = completedPts[i - 1];
          const cpx = (prev.x + pt.x) / 2;
          return acc + ` C ${cpx} ${prev.y} ${cpx} ${pt.y} ${pt.x} ${pt.y}`;
        }, '');
        return (
          <path d={cd} fill="none" stroke="url(#jpCompleted)" strokeWidth="1.2"
            strokeLinecap="round" filter="url(#jpGlow)" />
        );
      })()}
    </svg>
  );
}

/* ─── Individual Journey Node ─── */
function JourneyNode({ state, label, sublabel, isLast }) {
  // state: 'completed' | 'active' | 'next' | 'future'
  const nodeStyles = {
    completed: {
      outer: 'w-4 h-4 rounded-full flex items-center justify-center',
      outerStyle: { background: 'rgb(124,58,237)', boxShadow: '0 0 8px rgba(124,58,237,0.35)' },
      inner: null,
      textOpacity: 'opacity-50',
    },
    active: {
      outer: 'w-6 h-6 rounded-full flex items-center justify-center relative',
      outerStyle: { background: 'white', border: '2.5px solid rgb(67,56,202)', boxShadow: '0 0 20px rgba(67,56,202,0.40)' },
      inner: 'w-2.5 h-2.5 bg-brand rounded-full',
      textOpacity: 'opacity-100',
    },
    next: {
      outer: 'w-4 h-4 rounded-full flex items-center justify-center',
      outerStyle: { background: 'transparent', border: '2px dashed rgba(67,56,202,0.50)' },
      inner: null,
      textOpacity: 'opacity-55',
    },
    future: {
      outer: 'w-3.5 h-3.5 rounded-full',
      outerStyle: { background: 'transparent', border: '1.5px dashed rgba(245,158,11,0.35)' },
      inner: null,
      textOpacity: 'opacity-25',
    },
  };
  const s = nodeStyles[state] || nodeStyles.future;

  return (
    <div className={`flex items-center gap-3 ${s.textOpacity} transition-all duration-300`}>
      {/* Node indicator */}
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32 }}>
        {state === 'active' && (
          <div className="absolute w-10 h-10 rounded-full bg-brand/10 animate-slow-pulse" />
        )}
        <div className={s.outer} style={s.outerStyle}>
          {s.inner && <div className={s.inner} />}
        </div>
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold leading-tight ${
          state === 'active' ? 'text-sm text-ink' :
          state === 'completed' ? 'text-xs text-clay' :
          'text-xs text-clay'
        }`}>{label}</p>
        {sublabel && state !== 'future' && (
          <p className="text-[10px] text-clay/70 leading-tight mt-0.5">{sublabel}</p>
        )}
      </div>
    </div>
  );
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

  // ─── Journey State Machine (A1 — logic fully preserved) ─────────────────
  let heroState = {
    title: "Begin Your Journey",
    description: "Take your first Skill Challenge to establish your baseline and unlock your path.",
    actionText: "Start a Skill Challenge",
    actionUrl: "/assessment",
    icon: <Compass className="w-24 h-24 text-brand" />
  }

  if (nextSession) {
    const peerName = nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name
    const dateStr = new Date(nextSession.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    heroState = {
      title: "Enter the Learning Arena",
      description: "Your upcoming session is confirmed. Prepare to learn and practice.",
      actionText: "Join Arena →",
      actionUrl: `/session/${nextSession.id}`,
      icon: <Calendar className="w-24 h-24 text-brand" />,
      metadata: [
        { label: "Partner",     value: peerName },
        { label: "Focus Skill", value: nextSession.skill },
        { label: "Date",        value: dateStr },
        { label: "Time",        value: nextSession.start_time }
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
    if (activeLearningSkill.stage === "Discovered") {
      heroState = {
        title: "Take the Skill Challenge",
        description: `Assess your ${activeLearningSkill.skill_name} to establish your baseline and earn initial XP.`,
        actionText: "Start Challenge →",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`,
        icon: <ClipboardCheck className="w-24 h-24 text-brand" />
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
            description: `Your request to learn ${activeLearningSkill.skill_name} is awaiting response. Check your requests.`,
            actionText: "View Requests →",
            actionUrl: "/requests",
            icon: <Users className="w-24 h-24 text-brand" />
          }
        } else {
          heroState = {
            title: "Prepare for Learning",
            description: "Coordinate and schedule a session with your partner to continue your journey.",
            actionText: "Message Partner →",
            actionUrl: `/messages?request_id=${relevantRequest.id}`,
            icon: <BookOpen className="w-24 h-24 text-brand" />,
            metadata: [
              { label: "Partner",           value: relevantRequest.to_user_name },
              { label: "Focus Skill",       value: activeLearningSkill.skill_name },
              { label: "Recommended Topic", value: weakTopic || "General Practice" },
              { label: "Status",            value: "Waiting to schedule" }
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
    } else if (activeLearningSkill.stage === "Developing") {
      heroState = {
        title: "The Final Challenge Awaits",
        description: `You've completed the learning path for ${activeLearningSkill.skill_name}. Take the final challenge to earn your verified badge.`,
        actionText: "Take Final Challenge →",
        actionUrl: `/assessment?skill=${encodeURIComponent(activeLearningSkill.skill_name)}&role=learning&autoStart=true`,
        icon: <CheckCircle className="w-24 h-24 text-brand" />
      }
    } else if (activeLearningSkill.stage === "Mastery") {
      heroState = {
        title: "Mastery Achieved",
        description: `You hold a verified badge in ${activeLearningSkill.skill_name}. You can now guide others or begin a new quest.`,
        actionText: "Start New Quest →",
        actionUrl: "/marketplace",
        icon: <Award className="w-24 h-24 text-brand" />
      }
    }
  }

  const isEmptyState = skills.length === 0 && upcoming.length === 0

  // XP
  const totalPts = gamification?.total_points || user.points || 0
  const nextPts  = gamification?.next_milestone_points || 500
  const xpPct    = Math.min(100, (totalPts / nextPts) * 100)

  // Greeting
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // ─── Journey node sequence (data-driven, not hardcoded) ─────────────────
  // Builds a list of visible nodes with state, label, sublabel
  const journeyNodes = []
  if (activeLearningSkill) {
    // Node 0: Skill challenge
    const hasBaseline = activeLearningSkill.stage !== "Discovered"
    journeyNodes.push({
      state: hasBaseline ? 'completed' : 'active',
      label: 'Skill Challenge',
      sublabel: activeLearningSkill.skill_name,
    })
    
    // Node 1: Active learning
    if (hasBaseline) {
      const isDevelopingOrMastery = activeLearningSkill.stage === "Developing" || activeLearningSkill.stage === "Mastery"
      journeyNodes.push({
        state: isDevelopingOrMastery ? 'completed' : 'active',
        label: 'Partner Training',
        sublabel: weakTopic ? `Focus: ${weakTopic}` : activeLearningSkill.skill_name,
      })
    }
    
    // Node 2: Learning arena (session)
    if (nextSession) {
      journeyNodes.push({
        state: 'active',
        label: 'Learning Arena',
        sublabel: `With ${nextSession.tutor_id === user.id ? nextSession.learner_name : nextSession.tutor_name}`,
      })
    } else if (activeLearningSkill.stage === "Practicing") {
      journeyNodes.push({
        state: 'next',
        label: 'Learning Arena',
        sublabel: 'Schedule a session',
      })
    }
    
    // Node 3: Final challenge / mastery
    if (activeLearningSkill.stage === "Developing" || activeLearningSkill.stage === "Mastery") {
      journeyNodes.push({
        state: activeLearningSkill.stage === "Mastery" ? 'completed' : 'active',
        label: activeLearningSkill.stage === "Mastery" ? 'Mastery Earned' : 'Final Challenge',
        sublabel: activeLearningSkill.stage === "Mastery" ? `${activeLearningSkill.skill_name} — Verified` : 'Earn your badge',
      })
    } else {
      journeyNodes.push({
        state: 'future',
        label: 'Mastery Verification',
        sublabel: '',
      })
    }
  }
  const activeNodeIndex = journeyNodes.findIndex(n => n.state === 'active')

  return (
    <div className="min-h-screen pb-24 xl:pb-10 animate-fade-in stagger-1">

      {/* ═══════════════════════════════════════════════════════════════
          HERO BAND
          ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 md:pt-8 mb-0">
        <div className="relative rounded-[2.5rem] overflow-hidden">

          {/* Hero atmospheric */}
          <div className="absolute inset-0 bg-gradient-to-br from-brandLight/70 via-surface/50 to-lift/60" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_0%_0%,_rgba(67,56,202,0.10)_0%,_transparent_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_100%,_rgba(6,182,212,0.06)_0%,_transparent_70%)]" />
          <div className="absolute -top-8 -right-8 w-48 h-48 bg-brand2/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/6 rounded-full blur-2xl" />

          {/* Mini SVG circuit accent inside hero — subtle tech identity */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.05]" aria-hidden="true">
            <polyline points="75%,15% 82%,15% 82%,22% 88%,22%" stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" />
            <circle cx="75%" cy="15%" r="3" fill="rgb(67,56,202)" />
            <circle cx="88%" cy="22%" r="3" fill="rgb(124,58,237)" />
          </svg>

          <div className="relative z-10 p-6 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">

              {/* Left — Avatar + Identity */}
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-brand/15 rounded-full blur-lg scale-110" />
                  <Avatar name={user.name} size="lg"
                    className="relative z-10 ring-4 ring-white/70 shadow-lg" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-ink leading-none mb-2 truncate">
                    {user.name.split(' ')[0]}
                  </h1>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand bg-brand/10 border border-brand/20 px-2.5 py-1 rounded-full select-none">
                      <Award className="w-3 h-3" />
                      {gamification?.next_milestone_title || 'Explorer'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right — Context */}
              <div className="flex flex-col gap-4 w-full sm:w-auto sm:min-w-[210px] sm:items-end">
                {activeLearningSkill && (
                  <div className="flex flex-col gap-1 sm:text-right">
                    <p className="text-[9px] font-bold text-clay/70 uppercase tracking-[0.15em]">Currently Exploring</p>
                    <p className="text-base font-bold text-ink leading-tight">{activeLearningSkill.skill_name}</p>
                    {weakTopic && (
                      <>
                        <p className="text-[9px] font-bold text-clay/70 uppercase tracking-[0.15em] mt-0.5">Current Focus</p>
                        <p className="text-sm font-semibold text-brand2 leading-tight">{weakTopic}</p>
                      </>
                    )}
                    <p className="text-[10px] text-clay mt-0.5 italic">
                      {activeLearningSkill.what_happened}
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ─── HERO → JOURNEY VISUAL BRIDGE ───────────────────────────────
            A subtle descent connector: a small icon + dashed stem that
            visually links the hero band to the skill journey below.
            This makes the user feel: "my identity leads into my path."
        ─────────────────────────────────────────────────────────────────── */}
        {!isEmptyState && !loading && activeLearningSkill && (
          <div className="flex flex-col items-start pl-8 sm:pl-10 mt-0 pointer-events-none select-none" aria-hidden="true">
            {/* Thin dashed connector */}
            <div className="ml-[6px] w-px h-7 border-l-2 border-dashed border-brand/25" />
            {/* Small label */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand/20 border border-brand/35 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-brand/60" />
              </div>
              <span className="text-[10px] font-bold text-brand/45 uppercase tracking-widest">
                Skill Journey
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════════════════ */}
      {loading ? (
        showLoading ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-4">
            <div className="skeleton h-56 w-full rounded-3xl" />
            <div className="grid grid-cols-3 gap-4">
              <div className="skeleton col-span-2 h-32 rounded-2xl" />
              <div className="skeleton h-32 rounded-2xl" />
            </div>
          </div>
        ) : null

      ) : isEmptyState ? (
        /* ─── EMPTY STATE ─── */
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 animate-slide-up stagger-2">
          <div className="relative rounded-[2.5rem] overflow-hidden p-10 sm:p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-brandLight/50 via-surface/60 to-lift/70" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand/6 rounded-full blur-3xl pointer-events-none" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.06]" aria-hidden="true">
              <ellipse cx="50%" cy="50%" rx="45%" ry="35%"
                stroke="rgb(67,56,202)" strokeWidth="1" fill="none" strokeDasharray="6 10" />
              <ellipse cx="50%" cy="50%" rx="30%" ry="22%"
                stroke="rgb(124,58,237)" strokeWidth="1" fill="none" strokeDasharray="4 8" />
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6
          flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_280px] lg:gap-12 lg:items-start">

          {/* ══════════════════════════════════════════════════════
              LEFT — SKILL JOURNEY (visual center of the world)
              ══════════════════════════════════════════════════════ */}
          <section className="animate-slide-up stagger-2 contents lg:block">

            <div className="order-1 lg:order-none">
              {/* ─── JOURNEY CONTAINER ─── */}
              <div className="relative">

              {/* ─── CURVED PATH SVG (behind everything) ─── */}
              {journeyNodes.length >= 2 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 14,         /* align with node centers */
                    top: 32,
                    width: 4,
                    /* height is determined by the content, not fixed */
                    bottom: 24,
                  }}
                  aria-hidden="true"
                >
                  {/* Glowing completed segment */}
                  <div
                    className="w-full rounded-full"
                    style={{
                      height: activeNodeIndex > 0
                        ? `${(activeNodeIndex / Math.max(journeyNodes.length - 1, 1)) * 100}%`
                        : '0%',
                      background: 'linear-gradient(to bottom, rgb(124,58,237), rgb(67,56,202))',
                      boxShadow: '0 0 12px rgba(67,56,202,0.40)',
                    }}
                  />
                  {/* Pending dashed segment */}
                  <div
                    className="w-full"
                    style={{
                      height: activeNodeIndex >= 0
                        ? `${((journeyNodes.length - 1 - activeNodeIndex) / Math.max(journeyNodes.length - 1, 1)) * 100}%`
                        : '100%',
                      borderLeft: '2px dashed rgba(67,56,202,0.20)',
                    }}
                  />
                </div>
              )}

              {/* Fallback simple line when no active node */}
              {(journeyNodes.length === 0 || activeNodeIndex < 0) && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: 15, top: 36, bottom: 28, width: 2,
                    background: 'linear-gradient(to bottom, rgba(124,58,237,0.4) 0%, rgba(67,56,202,0.2) 50%, rgba(245,158,11,0.1) 100%)',
                    boxShadow: '0 0 8px rgba(67,56,202,0.20)',
                    borderRadius: 9999,
                  }}
                  aria-hidden="true"
                />
              )}

              <div className="space-y-1">

                {/* ─── JOURNEY NODES ─── */}
                {journeyNodes.map((node, i) => (
                  <div key={i} className="relative z-10 pb-4">
                    <JourneyNode
                      state={node.state}
                      label={node.label}
                      sublabel={node.sublabel}
                      isLast={i === journeyNodes.length - 1}
                    />
                  </div>
                ))}

                {/* Fallback for no active learning skill (empty journey nodes) */}
                {journeyNodes.length === 0 && (
                  <>
                    <div className="relative z-10 pb-5">
                      <JourneyNode state="active" label="Your Journey" sublabel="Set up your first skill path" />
                    </div>
                    <div className="relative z-10 pb-4 opacity-25">
                      <JourneyNode state="future" label="Mastery Verification" sublabel="" />
                    </div>
                  </>
                )}

              </div>
            </div>

            {/* ─── CURRENT QUEST REGION ─────────────────────────────────────────
                The "destination node" of the current journey segment.
                Visually differentiated from the timeline above:
                - larger, atmospheric, glass-like
                - clear eyebrow label tying it to the active node
                - offset left margin to feel like it extends from the path
            ───────────────────────────────────────────────────────────────────── */}
            <div className="order-2 lg:order-none mt-2 ml-9 animate-slide-up stagger-2">

              {/* Connector from last active node into quest region */}
              <div className="ml-[-22px] flex items-center gap-2 mb-3" aria-hidden="true">
                <div className="w-5 h-px border-t border-dashed border-brand/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-brand/40" />
                <p className="text-[9px] font-bold text-brand/50 uppercase tracking-widest select-none">
                  Your next move
                </p>
              </div>

              {/* Quest glass region */}
              <div
                className="relative rounded-[2rem] overflow-hidden group
                  transition-all duration-500
                  hover:shadow-[0_20px_60px_rgba(67,56,202,0.12)]"
                style={{
                  background: 'linear-gradient(135deg, rgba(236,238,255,0.78) 0%, rgba(255,255,255,0.58) 50%, rgba(244,244,250,0.68) 100%)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  border: '1px solid rgba(67,56,202,0.14)',
                }}
              >
                {/* Ambient glow pools */}
                <div className="absolute top-0 left-0 w-60 h-60 bg-brand/6 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute bottom-0 right-0 w-44 h-44 bg-accent/5 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                {/* Mini circuit accent inside quest panel */}
                <svg className="absolute top-4 right-4 opacity-[0.045] pointer-events-none" width="60" height="40" aria-hidden="true">
                  <polyline points="0,10 15,10 15,20 30,20 30,30 45,30" stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" />
                  <circle cx="0"  cy="10" r="2.5" fill="rgb(67,56,202)" />
                  <circle cx="45" cy="30" r="2.5" fill="rgb(124,58,237)" />
                </svg>

                <div className="relative z-10 p-6 md:p-7">

                  {/* Quest title */}
                  <h3 className="text-xl md:text-2xl font-display font-bold text-ink leading-tight mb-2.5">
                    {heroState.title}
                  </h3>

                  {/* Quest description */}
                  <p className="text-clay font-medium text-sm md:text-[0.9rem] max-w-lg leading-relaxed mb-5">
                    {heroState.description}
                  </p>

                  {/* Metadata grid */}
                  {heroState.metadata && (
                    <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-6 max-w-sm">
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
                    className="btn-brand text-sm px-7 py-3 rounded-full
                      shadow-[0_8px_24px_rgba(67,56,202,0.22)]
                      hover:shadow-[0_12px_32px_rgba(67,56,202,0.32)]
                      inline-flex transition-shadow"
                  >
                    {heroState.actionText}
                  </Link>
                </div>

                {/* Watermark icon */}
                <div className="absolute right-4 bottom-4 pointer-events-none opacity-[0.030] group-hover:opacity-[0.055] transition-opacity duration-700">
                  <div className="scale-[1.6] origin-bottom-right">
                    {heroState.icon}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* ─── OTHER ACTIVE LEARNING PATHS ─── */}
            {learningSkills.filter(s => s.id !== activeLearningSkill?.id).length > 0 && (
              <div className="order-4 lg:order-none lg:mt-8 animate-slide-up stagger-3">
                <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-3">Other Active Paths</p>
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

          {/* ══════════════════════════════════════════════════════
              RIGHT — STATE PANEL
              ══════════════════════════════════════════════════════ */}
          <aside className="animate-slide-up stagger-3 contents lg:block lg:space-y-7">

            {/* ─── COMING UP ─── */}
            <div className="order-3 lg:order-none">
              <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
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
                      size="md" className="shrink-0"
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
              <div className="h-px bg-gradient-to-r from-transparent via-line/40 to-transparent hidden lg:block" />
            )}

            {/* ─── MASTERED SKILLS ─── */}
            <div className="order-5 lg:order-none">
              <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-gold" />
                Mastered
              </p>
              {teachingSkills.length > 0 ? (
                <div className="space-y-1.5">
                  {teachingSkills.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl
                        bg-surface/50 backdrop-blur-sm border-l-2 border-gold/45
                        hover:bg-surface/80 transition-colors group"
                    >
                      <span className="font-semibold text-sm text-ink group-hover:text-ink/90">{s.skill_name}</span>
                      {s.badge && <SkillBadge badge={s.badge} />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line/35 px-4 py-5 text-center">
                  <Award className="w-5 h-5 text-clay/35 mx-auto mb-1.5" />
                  <p className="text-xs text-clay leading-relaxed">
                    Complete a skill path to add it to your inventory.
                  </p>
                </div>
              )}
            </div>

            {/* ─── QUICK ACTIONS ─── */}
            <div className="space-y-1 order-6 lg:order-none">
              <p className="text-[10px] font-bold text-clay uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Quick Actions
              </p>
              {[
                { to: '/marketplace',  label: 'Discover Partners' },
                { to: '/assessment',   label: 'Take a Skill Challenge' },
                { to: '/gamification', label: 'View Full Journey' },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl
                    text-sm font-semibold text-clay
                    hover:text-brand hover:bg-brand/6
                    transition-all duration-200 group"
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
