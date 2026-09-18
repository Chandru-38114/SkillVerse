import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import Materials from '../components/Materials'
import Notes from '../components/Notes'
import Chat from './chat'
import { Code2, PenLine, FileText, FolderOpen, ChevronDown, ChevronUp, Info, Hand, CheckCircle2, Play, BookOpen, User, Calendar } from 'lucide-react'

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
    <div className="flex flex-col bg-[#F8F9FA] h-[100dvh] w-full overflow-hidden text-ink">
      {/* 🚀 Header 🚀 */}
      <header className="flex-none bg-surface border-b border-line px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="font-display font-bold text-ink">Learning Arena</div>
          <div className="h-6 w-px bg-line" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/5 rounded-lg border border-brand/10">
            <span className="text-brand font-semibold text-sm">{session.skill_name || session.skill}</span>
            <span className="text-clay text-xs">with {peerName}</span>
          </div>
        </div>

        {/* Center: Time */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
               <Calendar className="w-4 h-4 text-clay" />
               <span className="text-sm font-medium text-ink">Today • {session.start_time || 'Now'}</span>
            </div>
            {timeLeft && !isCompleted && (
               <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-clay/10 text-clay font-medium text-xs">
                 <span>Ends in</span>
                 <span className="font-mono tracking-wider">{timeLeft}</span>
               </div>
            )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
           <button onClick={handleLeave} className="btn-secondary text-xs px-4 py-2 hover:bg-line/50 transition-colors">
             Leave Session
           </button>
           {!isCompleted && (
             <button onClick={handleComplete} disabled={completing} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm">
               <CheckCircle2 className="w-4 h-4" />
               Complete Session
             </button>
           )}
        </div>
      </header>

      {/* 🚀 Main Body 🚀 */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* Left Navigation */}
        <div className="w-20 shrink-0 bg-surface border-r border-line flex flex-col items-center py-4 gap-4 z-10 hidden sm:flex shadow-[2px_0_10px_-4px_rgba(0,0,0,0.05)]">
           {TABS.map(({ id, label, Icon }) => (
              <a 
                href={`#section-${id}`} 
                key={id}
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab(id)
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`flex flex-col items-center gap-1.5 p-2 w-14 rounded-xl transition-all ${
                  activeTab === id ? 'bg-brand/10 text-brand' : 'text-clay hover:text-ink hover:bg-ink/5'
                }`}
              >
                 <Icon className="w-5 h-5" />
                 <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </a>
           ))}
        </div>

        <VideoChat 
           sessionId={session.id} 
           onLeave={handleLeave} 
           chatComponent={<Chat requestId={session.request_id || req?.id} embedded={true} />}
        >
          {/* 🚀 Workspace 🚀 */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-paper p-4 lg:p-6 gap-6 scroll-smooth">
            
            {/* Today's Quest Area */}
            {session.notes && (
              <div className="bg-surface rounded-xl p-4 lg:p-5 border border-line shadow-sm flex items-start gap-4 shrink-0 mx-auto max-w-5xl w-full">
                 <div className="p-2 bg-brand/10 rounded-lg shrink-0 mt-0.5">
                   <BookOpen className="w-5 h-5 text-brand" />
                 </div>
                 <div>
                   <p className="text-xs font-bold text-clay uppercase tracking-wider mb-1">Today's Quest</p>
                   <p className="text-sm font-medium text-ink leading-relaxed">{session.notes}</p>
                 </div>
              </div>
            )}

            <div className="mx-auto max-w-5xl w-full flex flex-col gap-6">
               
               {/* Whiteboard + Compiler row */}
               <div id="section-Code" className="flex flex-col xl:flex-row gap-6 h-[800px] xl:h-[600px] shrink-0">
                  {/* Whiteboard */}
                  <div id="section-Whiteboard" className="flex-1 bg-surface border border-line rounded-2xl shadow-sm overflow-hidden flex flex-col relative group h-full">
                     <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-line shadow-sm flex items-center gap-2 pointer-events-none transition-opacity group-hover:opacity-30">
                        <PenLine className="w-4 h-4 text-brand" />
                        <span className="text-xs font-bold text-ink tracking-wide">Whiteboard</span>
                     </div>
                     <div className="absolute inset-0 z-10">
                         <Whiteboard sessionId={session.id} />
                     </div>
                  </div>

                  {/* Compiler */}
                  <div className="flex-1 bg-surface border border-line rounded-2xl shadow-sm overflow-hidden flex flex-col relative group h-full">
                     <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-line shadow-sm flex items-center gap-2 pointer-events-none transition-opacity group-hover:opacity-30">
                        <Code2 className="w-4 h-4 text-brand" />
                        <span className="text-xs font-bold text-ink tracking-wide">Compiler</span>
                     </div>
                     <div className="absolute inset-0 z-10 pt-16 xl:pt-14 bg-surface">
                        <Compiler sessionId={session.id} />
                     </div>
                  </div>
               </div>

               {/* Notes + Materials row */}
               <div id="section-Notes" className="flex flex-col xl:flex-row gap-6 h-[500px] shrink-0">
                  
                  {/* Notes */}
                  <div className="flex-1 bg-surface border border-line rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                     <div className="px-5 py-4 border-b border-line flex items-center gap-3 bg-lift/30 shrink-0">
                        <div className="p-1.5 bg-brand/10 rounded-md">
                           <FileText className="w-4 h-4 text-brand" />
                        </div>
                        <span className="text-sm font-bold text-ink">Session Notes</span>
                     </div>
                     <div className="flex-1 overflow-y-auto relative p-2 bg-surface">
                        {notesLoaded && <Notes session={session} data={notesData} onChange={setNotesData} isCompleted={isCompleted} />}
                     </div>
                  </div>

                  {/* Materials */}
                  <div id="section-Materials" className="flex-1 bg-surface border border-line rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                     <div className="px-5 py-4 border-b border-line flex items-center gap-3 bg-lift/30 shrink-0">
                        <div className="p-1.5 bg-brand/10 rounded-md">
                           <FolderOpen className="w-4 h-4 text-brand" />
                        </div>
                        <span className="text-sm font-bold text-ink">Materials</span>
                     </div>
                     <div className="flex-1 overflow-y-auto relative p-2 bg-surface">
                        <Materials session={session} />
                     </div>
                  </div>
               </div>

               {/* Bottom Spacer */}
               <div className="h-12 shrink-0"></div>

            </div>
          </div>
        </VideoChat>
      </div>
    </div>
  )
}

import ErrorBoundary from '../components/ErrorBoundary';
export default function SessionRoom() { return <ErrorBoundary><SessionRoomComponent /></ErrorBoundary>; }

