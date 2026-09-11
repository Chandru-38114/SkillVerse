import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import Materials from '../components/Materials'
import Notes from '../components/Notes'
import Chat from './chat'
import SkillVerseLogo from '../components/SkillVerseLogo'
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react'

const TABS = ['Code', 'Whiteboard', 'Notes', 'Materials', 'Chat']

export default function SessionRoom() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('Code')
  const navigate = useNavigate()

  useEffect(() => {
    api.getSession(sessionId)
      .then(setSession)
      .catch(err => setError(err.message))
  }, [sessionId])

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center mt-12">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-2xl font-display mb-2">Room Error</h1>
        <p className="text-ink/60 mb-8">{error}</p>
        <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (session.status === 'cancelled') {
    return (
      <div className="max-w-xl mx-auto p-12 text-center mt-12">
        <p className="text-4xl mb-4">🚫</p>
        <h1 className="text-2xl font-display mb-2">Session Cancelled</h1>
        <p className="text-ink/60 mb-8">This learning session has been cancelled.</p>
        <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
      </div>
    )
  }

  if (session.status === 'completed') {
    return (
      <div className="max-w-xl mx-auto p-12 text-center mt-12">
        <p className="text-4xl mb-4">✅</p>
        <h1 className="text-2xl font-display mb-2">Session Completed</h1>
        <p className="text-ink/60 mb-8">This session has already ended.</p>
        <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
      </div>
    )
  }

  const isLearner = session.learner_id === user.id
  const isTutor = !isLearner
  const peerName = isLearner ? session.tutor_name : session.learner_name
  const req = session.request

  return (
    <div className="h-screen flex flex-col bg-[#FDFDFC] overflow-hidden font-body">
      {/* Header */}
      <header className="h-14 border-b border-line bg-white px-3 md:px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <SkillVerseLogo />
          <div className="h-6 w-px bg-line"></div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm capitalize text-ink tracking-tight">{session.skill}</h1>
            {session.skill_level && (
              <span className="text-[10px] uppercase tracking-wider bg-moss/10 text-moss px-1.5 py-0.5 rounded font-bold">
                {session.skill_level}
              </span>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs text-ink/60 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-moss animate-pulse"></span>
            2 Participants
          </div>
          <div className="h-4 w-px bg-line/60"></div>
          <div>
            {formatDate(session.session_date)} — {session.start_time}
          </div>
        </div>
      </header>

      {/* Main Area: VideoChat Wraps Everything */}
      <div className="flex-1 flex overflow-hidden relative">
        <VideoChat sessionId={session.id}>
          {/* Workspace Tabs (Center) */}
          <main className="flex-1 flex flex-col bg-[#FDFDFC] min-w-0 shadow-[-4px_0_12px_rgba(0,0,0,0.02)] z-10 relative">
            {/* Tab Bar */}
            <div className="flex px-2 border-b border-line bg-white pt-2 shrink-0 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
              {TABS.map(t => (
                <button 
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-5 py-2 text-sm font-semibold border-b-2 transition-colors mx-1 ` + (
                    activeTab === t ? 'border-moss text-moss' : 'border-transparent text-ink/40 hover:text-ink/70'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Contents (All rendered but hidden if inactive) */}
            <div className="flex-1 relative bg-paper overflow-hidden">
               <div className={`absolute inset-0 ` + (activeTab === 'Code' ? 'flex flex-col' : 'hidden')}>
                  <Compiler sessionId={session.id} />
               </div>
               <div className={`absolute inset-0 ` + (activeTab === 'Whiteboard' ? 'flex flex-col' : 'hidden')}>
                  <Whiteboard sessionId={session.id} />
               </div>
               <div className={`absolute inset-0 ` + (activeTab === 'Notes' ? 'flex flex-col overflow-y-auto' : 'hidden')}>
                  <Notes sessionId={session.id} />
               </div>
               <div className={`absolute inset-0 p-6 ` + (activeTab === 'Materials' ? 'flex flex-col overflow-y-auto' : 'hidden')}>
                  <Materials session={session} />
               </div>
               <div className={`absolute inset-0 ` + (activeTab === 'Chat' ? 'flex flex-col' : 'hidden')}>
                  <Chat embeddedRequestId={session.request_id} embedded={true} />
               </div>
            </div>
          </main>

          {/* Info Panel (Right) */}
          <aside className="w-72 border-l border-line bg-white shrink-0 overflow-y-auto p-5 hidden xl:block z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink/40 font-bold mb-3">Knowledge Exchange</p>
              
              <div className="space-y-4 text-sm bg-moss/5 border border-moss/10 rounded-xl p-4 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-moss/70 mb-0.5">You are {isTutor ? 'teaching' : 'learning'}</p>
                  <p className="font-bold text-moss">{session.skill_name}</p>
                </div>
                
                {req?.learner_can_teach && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-clay/70 mb-0.5">You {isTutor ? 'can learn' : 'can teach'}</p>
                    <p className="font-bold text-clay">{req.learner_can_teach} <span className="text-xs font-normal opacity-70">({req.learner_teach_proficiency})</span></p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4 text-sm bg-ink/5 border border-line/60 rounded-xl p-4 mt-4 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50 mb-0.5">Partner ({peerName}) is {isTutor ? 'learning' : 'teaching'}</p>
                  <p className="font-bold text-ink">{session.skill_name}</p>
                </div>
                
                {req?.learner_can_teach && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50 mb-0.5">Partner {isTutor ? 'can teach' : 'wants to learn'}</p>
                    <p className="font-bold text-ink">{req.learner_can_teach}</p>
                  </div>
                )}
              </div>
              
              {session.notes && (
                <div className="mt-5 p-4 bg-paper rounded-xl text-sm border border-line shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50 mb-1.5">Agenda / Notes</p>
                  <p className="text-ink/80 leading-relaxed">{session.notes}</p>
                </div>
              )}
            </div>

            {req && (req.learner_current_level || req.learner_topics || req.learner_goals) && (
              <div className="pt-6 mt-6 border-t border-line/60">
                <p className="text-[10px] uppercase tracking-wider text-ink/40 font-bold mb-4">Learner Context</p>
                <div className="space-y-4 text-sm">
                  {req.learner_current_level && (
                    <div>
                      <p className="text-ink/40 text-[11px] font-bold uppercase tracking-wider mb-0.5">Current Level</p>
                      <p className="font-medium text-ink/80">{req.learner_current_level}</p>
                    </div>
                  )}
                  {req.learner_topics && (
                    <div>
                      <p className="text-ink/40 text-[11px] font-bold uppercase tracking-wider mb-0.5">Topics</p>
                      <p className="font-medium text-ink/80">{req.learner_topics}</p>
                    </div>
                  )}
                  {req.learner_goals && (
                    <div>
                      <p className="text-ink/40 text-[11px] font-bold uppercase tracking-wider mb-0.5">Goals</p>
                      <p className="font-medium text-ink/80 leading-relaxed">{req.learner_goals}</p>
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

function formatDate(isoDate) {
  try {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch { return isoDate }
}
