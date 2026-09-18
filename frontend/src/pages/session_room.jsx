import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import Materials from '../components/Materials'
import Notes from '../components/Notes'
import { Code2, PenLine, FileText, FolderOpen, ChevronDown, ChevronUp, Info, Hand, CheckCircle2, Play, BookOpen } from 'lucide-react'

const TABS = [
  { id: 'Code',       label: 'Code',   Icon: Code2 },
  { id: 'Whiteboard', label: 'Board',  Icon: PenLine },
  { id: 'Notes',      label: 'Notes',  Icon: FileText },
  { id: 'Materials',  label: 'Files',  Icon: FolderOpen },
]

function SessionRoomComponent() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const navigate = useNavigate()
  
  const [session, setSession] = useState(null)
  const [req, setReq] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Code')
  const [infoOpen, setInfoOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [notesData, setNotesData] = useState({
    topics_discussed: "",
    topics_completed: "",
    learning_notes: ""
  })
  const [isCompleted, setIsCompleted] = useState(false)
  const [notesLoaded, setNotesLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const s = await api.getSession(sessionId)
        setSession(s)
        setReq(s.request)
        setIsCompleted(s.status === 'completed')
        
        try {
          const res = await api.getSessionProgress(sessionId)
          setNotesData({
            topics_discussed: res.topics_discussed || "",
            topics_completed: res.topics_completed || "",
            learning_notes: res.learning_notes || ""
          })
          if (res.duration_minutes > 0) setIsCompleted(true)
        } catch (err) {
          // ignore 404 for notes
        } finally {
          setNotesLoaded(true)
        }
      } catch (err) {
        setError(err.message || 'Failed to load session')
      }
    }
    load()
  }, [sessionId])

  useEffect(() => {
    if (!session || session.status === 'completed' || !session.scheduled_end) return
    const timer = setInterval(() => {
      const diff = new Date(session.scheduled_end) - new Date()
      if (diff <= 0) {
        setTimeLeft('00:00')
        clearInterval(timer)
      } else {
        const m = Math.floor(diff / 60000).toString().padStart(2, '0')
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
        setTimeLeft(`${m}:${s}`)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [session])

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-paper h-[100dvh]">
      <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4"><Info className="w-8 h-8" /></div>
      <h2 className="text-xl font-bold mb-2">Session Error</h2>
      <p className="text-clay mb-6">{error}</p>
      <Link to="/sessions" className="btn-primary">Return to Dashboard</Link>
    </div>
  )
  if (!session) return <div className="flex-1 flex items-center justify-center h-[100dvh] text-clay">Loading session...</div>

  const isTutor = user.id === session.tutor_id
  const peerName = isTutor ? session.learner_name : session.tutor_name

  const formatDate = (ds) => {
    if (!ds) return ''
    const d = new Date(ds)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const formatTime = (ds) => {
    if (!ds) return ''
    const d = new Date(ds)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const handleLeave = () => {
    if (session?.request_id) {
      navigate(`/messages?request_id=${session.request_id}`)
    } else if (req?.id) {
      navigate(`/messages?request_id=${req.id}`)
    } else {
      navigate('/sessions')
    }
  }

  const handleComplete = async () => {
    if (!window.confirm("Are you sure you want to complete this session? This will update your skill progress and cannot be undone.")) return;
    
    setCompleting(true)
    try {
      await api.saveSessionNotes(sessionId, notesData)
      const res = await api.completeSessionProgress(sessionId)
      setIsCompleted(true)
      if (session?.request_id) {
        navigate(`/messages?request_id=${session.request_id}`)
      } else if (req?.id) {
        navigate(`/messages?request_id=${req.id}`)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      alert("Failed to complete session: " + err.message)
      setCompleting(false)
    }
  }

  return (
    <div className="flex flex-col bg-paper h-[100dvh] w-full overflow-hidden">
      {/* 🚀 Header 🚀 */}
      <header className="flex-none bg-surface border-b border-line px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-ink text-sm sm:text-base leading-tight truncate">
              Learning {session.skill_name || session.skill} with {peerName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs font-semibold text-clay">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isCompleted ? 'bg-clay' : 'bg-green-500 animate-pulse'}`}></span>
              <span className="capitalize">{isCompleted ? 'Ended' : 'Live'}</span>
              <span className="text-line">•</span>
              <span className="capitalize">{isTutor ? 'Tutor' : 'Learner'}</span>
              
              {session.notes && (
                <>
                  <span className="text-line hidden sm:inline">•</span>
                  <span className="hidden sm:flex items-center gap-1 text-ink/70 truncate" title={session.notes}>
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    Today's focus: <span className="italic font-normal truncate">{session.notes}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {timeLeft && !isCompleted && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clay/10 text-clay font-medium text-xs">
              <span>Ends in</span>
              <span className="font-mono tracking-wider">{timeLeft}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button onClick={handleLeave} className="btn-secondary text-xs px-4 py-2 hover:bg-line/50 transition-colors">
              Leave
            </button>
            {!isCompleted && (
              <button onClick={handleComplete} disabled={completing} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-4 h-4" />
                {completing ? 'Completing...' : 'Complete Session'}
              </button>
            )}
            
            <button
              onClick={() => setInfoOpen(v => !v)}
              className="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink/60 bg-ink/5 hover:bg-ink/10 transition-colors shrink-0"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 🚀 Collapsible info banner (mobile) 🚀 */}
      {infoOpen && (
        <div className="sm:hidden bg-surface border-b border-line px-4 py-3 shrink-0 z-10">
          <div className="flex gap-5 text-sm flex-wrap mb-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Date</span>
              <span className="font-semibold text-ink">{formatDate(session.scheduled_start || session.session_date)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Time</span>
              <span className="font-semibold text-ink">{session.start_time} — {session.end_time}</span>
            </div>
            {timeLeft && !isCompleted && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-ink/40 font-bold block mb-0.5">Ends in</span>
                <span className="font-semibold text-ink">{timeLeft}</span>
              </div>
            )}
          </div>
          {session.notes && (
            <div className="text-xs text-ink/70 border-t border-line pt-2 flex items-start gap-1.5">
              <BookOpen className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <span className="italic leading-relaxed">{session.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* 🚀 Main Body 🚀 */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <VideoChat sessionId={session.id} onLeave={handleLeave}>
          {/* 🚀 Workspace: unified tabs 🚀 */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0 bg-surface">
            {/* Tab bar */}
            <div className="flex shrink-0 border-b border-line bg-lift/30 overflow-x-auto overflow-y-hidden scrollbar-hide px-2">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? 'border-brand text-brand bg-brand/5'
                      : 'border-transparent text-clay hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Content Area - Unified Tabs */}
            <div className="flex-1 relative overflow-hidden min-h-0">
              {/* Whiteboard */}
              <div className={`absolute inset-0 z-10 flex flex-col bg-surface ${activeTab === 'Whiteboard' ? 'block' : 'hidden'}`}>
                <Whiteboard sessionId={session.id} />
              </div>

              {/* Compiler */}
              <div className={`absolute inset-0 z-10 flex flex-col bg-surface ${activeTab === 'Code' ? 'block' : 'hidden'}`}>
                <Compiler sessionId={session.id} />
              </div>
            
              {/* Notes */}
              <div className={`absolute inset-0 z-10 flex flex-col bg-surface overflow-y-auto ${activeTab === 'Notes' ? 'block' : 'hidden'}`}>
                {notesLoaded && (
                  <Notes 
                    session={session} 
                    data={notesData} 
                    onChange={setNotesData} 
                    isCompleted={isCompleted} 
                  />
                )}
              </div>
            
              {/* Materials */}
              <div className={`absolute inset-0 z-10 flex flex-col bg-surface overflow-y-auto ${activeTab === 'Materials' ? 'block' : 'hidden'}`}>
                <Materials session={session} />
              </div>
            </div>
          </div>
        </VideoChat>
      </div>
    </div>
  )
}

import ErrorBoundary from '../components/ErrorBoundary';
export default function SessionRoom() { return <ErrorBoundary><SessionRoomComponent /></ErrorBoundary>; }

