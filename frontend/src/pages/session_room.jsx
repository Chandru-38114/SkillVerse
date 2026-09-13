import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import Materials from '../components/Materials'
import Notes from '../components/Notes'
import Chat from './chat'
import { Code2, PenLine, FileText, FolderOpen, MessageSquare, ChevronDown, ChevronUp, Info } from 'lucide-react'

const TABS = [
  { id: 'Code',       label: 'Code',   Icon: Code2 },
  { id: 'Whiteboard', label: 'Board',  Icon: PenLine },
  { id: 'Notes',      label: 'Notes',  Icon: FileText },
  { id: 'Materials',  label: 'Files',  Icon: FolderOpen },
  { id: 'Chat',       label: 'Chat',   Icon: MessageSquare },
]

function SessionRoomComponent() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('Code')
  const [infoOpen, setInfoOpen] = useState(false)
  const navigate = useNavigate()

  const [timeLeft, setTimeLeft] = useState(null)
  const [isEnded, setIsEnded] = useState(false)

  useEffect(() => {
    if (!session) return;
    const endObj = new Date(session.scheduled_end);
    
    const updateTimer = () => {
      const now = new Date();
      const diff = endObj - now;
      if (diff <= 0) {
        setIsEnded(true);
        setTimeLeft('00:00');
      } else {
        const totalSecs = Math.floor(diff / 1000);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };
    
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    api.getSession(sessionId)
      .then(setSession)
      .catch(err => {
        if (err.response?.status === 410 || String(err).includes('410') || String(err).includes('expired')) {
          setIsEnded(true)
        } else {
          setError(err.message)
        }
      })
  }, [sessionId])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper p-4">
        <div className="max-w-md w-full text-center p-8 card">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-display mb-2">Room Unavailable</h1>
          <p className="text-ink/60 mb-8 text-sm">{error}</p>
          <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink/50 text-sm">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper p-4">
        <div className="max-w-md w-full text-center p-8 card">
          <h1 className="text-2xl font-display mb-2">Authentication Required</h1>
          <p className="text-ink/60 mb-8 text-sm">Please log in to join this session.</p>
          <Link to="/login" className="btn-primary">Login</Link>
        </div>
      </div>
    )
  }

  if (session.status === 'cancelled') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper p-4">
        <div className="max-w-md w-full text-center p-8 card">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-display mb-2">Session Cancelled</h1>
          <p className="text-ink/60 mb-8 text-sm">This learning session has been cancelled.</p>
          <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
        </div>
      </div>
    )
  }

  if (session.status === 'completed') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper p-4">
        <div className="max-w-md w-full text-center p-8 card">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-display mb-2">Session Completed</h1>
          <p className="text-ink/60 mb-8 text-sm">This session has already ended.</p>
          <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
        </div>
      </div>
    )
  }


  if (isEnded || (session && session.status === 'completed')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper p-4">
        <div className="max-w-md w-full text-center p-8 card border-t-4 border-t-brand">
          <div className="text-5xl mb-4">⏱️</div>
          <h1 className="text-2xl font-display mb-2">Session Ended</h1>
          <p className="text-ink/60 mb-8 text-sm">This scheduled session has reached its end time and is no longer available.</p>
          <Link to="/sessions" className="btn-primary inline-flex">Return to Sessions</Link>
        </div>
      </div>
    )
  }

  const isLearner = session.learner_id === user.id
  const isTutor = !isLearner
  const peerName = isLearner ? session.tutor_name : session.learner_name
  const req = session.request

  return (
    <div className="h-[100dvh] flex flex-col bg-[#FDFDFC] overflow-hidden font-body">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-line bg-white px-3 sm:px-5 flex items-center justify-between z-20 shadow-sm gap-3 h-[52px]">
        {/* Logo + session info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0" title="SkillVerse Home">
            <div className="w-7 h-7 rounded-full bg-brandLight/50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="hidden sm:block font-display text-base font-bold tracking-tight text-ink">Skill<span className="text-brand">Verse</span></span>
          </Link>
          <div className="h-5 w-px bg-line shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <p className="hidden sm:block text-[10px] text-ink/40 font-bold uppercase tracking-wider leading-none mb-0.5">
              {isTutor ? 'Teaching' : 'Learning'}
            </p>
            <h1 className="font-semibold text-sm capitalize text-ink tracking-tight truncate max-w-[180px] sm:max-w-[220px]">{session.skill}</h1>
          </div>
        </div>

        {/* Right side meta */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-3 text-xs text-ink/50 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-moss animate-pulse shrink-0" />
              {peerName && <span>with <strong className="text-ink/70">{peerName}</strong></span>}
            </div>
            <span className="text-ink/20">·</span>
            <span>{formatDate(session.scheduled_start || session.session_date)}, {session.start_time}</span>
          </div>
          {/* Right side: Timer & Mobile Info toggle */}
          <div className="flex items-center gap-2">
            {timeLeft && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clay/10 text-clay font-medium text-xs">
                <span>Ends in</span>
                <span className="font-mono tracking-wider">{timeLeft}</span>
              </div>
            )}
            <button
              onClick={() => setInfoOpen(v => !v)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink/60 bg-ink/5 hover:bg-ink/10 transition-colors shrink-0"
              title="Session info"
            >
              <Info className="w-3.5 h-3.5" />
              {infoOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Collapsible info banner (mobile/tablet) ─────────── */}
      {infoOpen && (
        <div className="lg:hidden bg-white border-b border-line px-4 py-3 shrink-0 z-10">
          <div className="flex gap-5 text-sm flex-wrap">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Peer</span>
              <span className="font-semibold text-ink">{peerName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Date</span>
              <span className="font-semibold text-ink">{formatDate(session.scheduled_start || session.session_date)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Time</span>
              <span className="font-semibold text-ink">{session.start_time} – {session.end_time}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Role</span>
              <span className="font-semibold text-ink capitalize">{isTutor ? 'Tutor' : 'Learner'}</span>
            </div>
          </div>
          {session.notes && (
            <p className="mt-2 text-xs text-ink/60 border-t border-line pt-2 leading-relaxed">{session.notes}</p>
          )}
        </div>
      )}

      {/* ── Main Body ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <VideoChat sessionId={session.id} onLeave={() => navigate('/sessions')}>
          {/* ── Workspace: tabs + panels ────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
            {/* Tab bar — scrollable on small screens */}
            <div className="flex shrink-0 border-b border-line bg-white overflow-x-auto overflow-y-hidden scrollbar-hide">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? 'border-moss text-moss bg-moss/5'
                      : 'border-transparent text-ink/40 hover:text-ink/60 hover:bg-ink/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab panels — absolute layered for state preservation */}
            <div className="flex-1 relative overflow-hidden min-h-0">
              <div className={`absolute inset-0 ${activeTab === 'Code'       ? 'flex flex-col' : 'hidden'}`}>
                <Compiler sessionId={session.id} />
              </div>
              <div className={`absolute inset-0 ${activeTab === 'Whiteboard' ? 'flex flex-col' : 'hidden'}`}>
                <Whiteboard sessionId={session.id} />
              </div>
              <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'Notes'     ? 'flex flex-col' : 'hidden'}`}>
                <Notes sessionId={session.id} />
              </div>
              <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'Materials' ? 'flex flex-col' : 'hidden'}`}>
                <Materials session={session} />
              </div>
              <div className={`absolute inset-0 ${activeTab === 'Chat'       ? 'flex flex-col' : 'hidden'}`}>
                <Chat embeddedRequestId={session.request_id} embedded={true} />
              </div>
            </div>
          </div>

          {/* ── Desktop right sidebar ──────────────────────── */}
          <aside className="hidden xl:flex w-60 shrink-0 border-l border-line bg-white flex-col overflow-y-auto z-10">
            <div className="p-4 border-b border-line">
              <p className="text-[10px] uppercase tracking-wider text-ink/40 font-bold mb-3">Exchange</p>
              <div className="space-y-3 text-sm bg-moss/5 border border-moss/10 rounded-xl p-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-moss/70 mb-0.5">You {isTutor ? 'teach' : 'learn'}</p>
                  <p className="font-bold text-moss text-sm">{session.skill_name || session.skill}</p>
                </div>
                {req?.learner_can_teach && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-clay/70 mb-0.5">Can offer</p>
                    <p className="font-semibold text-clay text-sm">{req.learner_can_teach}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm bg-ink/5 border border-line/60 rounded-xl p-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink/50 mb-0.5">{peerName}</p>
                  <p className="font-semibold text-ink text-sm">{isTutor ? 'Learning' : 'Teaching'} {session.skill_name || session.skill}</p>
                </div>
              </div>
              {session.notes && (
                <div className="mt-3 p-3 bg-paper rounded-xl text-sm border border-line">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink/50 mb-1.5">Agenda</p>
                  <p className="text-ink/70 leading-relaxed text-xs">{session.notes}</p>
                </div>
              )}
            </div>
            {req && (req.learner_current_level || req.learner_topics || req.learner_goals) && (
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-ink/40 font-bold mb-3">Learner Context</p>
                <div className="space-y-3 text-sm">
                  {req.learner_current_level && (
                    <div>
                      <p className="text-ink/40 text-[10px] font-bold uppercase tracking-wider mb-0.5">Level</p>
                      <p className="font-medium text-ink/80 text-xs">{req.learner_current_level}</p>
                    </div>
                  )}
                  {req.learner_topics && (
                    <div>
                      <p className="text-ink/40 text-[10px] font-bold uppercase tracking-wider mb-0.5">Topics</p>
                      <p className="font-medium text-ink/80 text-xs">{req.learner_topics}</p>
                    </div>
                  )}
                  {req.learner_goals && (
                    <div>
                      <p className="text-ink/40 text-[10px] font-bold uppercase tracking-wider mb-0.5">Goals</p>
                      <p className="font-medium text-ink/80 leading-relaxed text-xs">{req.learner_goals}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </VideoChat>
      </div>
    </div>
  )
}



import ErrorBoundary from '../components/ErrorBoundary';
export default function SessionRoom() { return <ErrorBoundary><SessionRoomComponent /></ErrorBoundary>; }
