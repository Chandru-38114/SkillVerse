import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import Materials from '../components/Materials'
import Notes from '../components/Notes'
import { Code2, PenLine, FileText, FolderOpen, ChevronDown, ChevronUp, Info, Hand } from 'lucide-react'

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
  const [prevTab, setPrevTab] = useState('Code')
  const [infoOpen, setInfoOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const s = await api.getSession(sessionId)
        setSession(s)
        setReq(s.request)
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

  return (
    <div className="flex flex-col bg-paper h-[100dvh] w-full overflow-hidden">
      {/* 🚀 Header 🚀 */}
      <header className="flex-none bg-surface border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/sessions" className="w-8 h-8 flex items-center justify-center text-clay hover:text-ink hover:bg-line/50 rounded-lg transition-colors shrink-0">
            <span className="text-xl leading-none">&times;</span>
          </Link>
          <div>
            <h1 className="font-display font-bold text-ink text-sm sm:text-base leading-tight">
              {session.skill_name || session.skill}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-clay' : 'bg-green-500 animate-pulse'}`}></span>
              <span className="text-xs font-semibold text-clay capitalize">
                {session.status === 'completed' ? 'Ended' : 'Live'} • {peerName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end text-xs font-semibold text-clay">
            <span>{formatDate(session.scheduled_start || session.session_date)}, {session.scheduled_start ? formatTime(session.scheduled_start) : session.start_time}</span>
          </div>
          {/* Right side: Timer & Desktop Notes/Materials & Mobile Info toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setPrevTab(activeTab); setActiveTab('Notes'); }} className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink/70 bg-ink/5 hover:bg-ink/10 transition-colors">
              <FileText className="w-3.5 h-3.5" /> Notes
            </button>
            <button onClick={() => { setPrevTab(activeTab); setActiveTab('Materials'); }} className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink/70 bg-ink/5 hover:bg-ink/10 transition-colors">
              <FolderOpen className="w-3.5 h-3.5" /> Files
            </button>
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

      {/* 🚀 Collapsible info banner (mobile/tablet) 🚀 */}
      {infoOpen && (
        <div className="lg:hidden bg-surface border-b border-line px-4 py-3 shrink-0 z-10">
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
              <span className="font-semibold text-ink">{session.start_time} — {session.end_time}</span>
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

      {/* 🚀 Main Body 🚀 */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <VideoChat sessionId={session.id} onLeave={() => navigate('/sessions')}>
          {/* 🚀 Workspace: tabs + panels 🚀 */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
            {/* Tab bar — ONLY ON MOBILE */}
            <div className="lg:hidden flex shrink-0 border-b border-line bg-surface overflow-x-auto overflow-y-hidden scrollbar-hide">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { if(id !== 'Notes' && id !== 'Materials') setPrevTab(id); setActiveTab(id); }}
                  className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? 'border-brand text-brand bg-brand/5'
                      : 'border-transparent text-ink/50 hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Content Area - Split on Desktop, Tabbed on Mobile */}
            <div className="flex-1 relative overflow-hidden min-h-0 flex flex-col xl:flex-row">
              {/* Whiteboard - Left on Desktop */}
              <div className={`
                absolute inset-0 bg-surface z-10
                ${activeTab === 'Whiteboard' ? 'flex flex-col' : 'hidden'}
                xl:relative xl:flex xl:flex-col xl:flex-1 xl:border-r xl:border-line xl:z-0
              `}>
                <Whiteboard sessionId={session.id} />
              </div>

              {/* Compiler - Right on Desktop */}
              <div className={`
                absolute inset-0 bg-surface z-10
                ${activeTab === 'Code' ? 'flex flex-col' : 'hidden'}
                xl:relative xl:flex xl:flex-col xl:flex-1 xl:z-0
              `}>
                <Compiler sessionId={session.id} />
              </div>
            </div>
            
            {/* Full-screen overlays for Notes & Materials */}
            {activeTab === 'Notes' && (
              <div className="absolute inset-0 z-50 flex flex-col bg-surface overflow-y-auto">
                <Notes session={session} onBack={() => setActiveTab(prevTab)} onCompleteSuccess={() => navigate('/dashboard')} />
              </div>
            )}
            
            {activeTab === 'Materials' && (
              <div className="absolute inset-0 z-50 flex flex-col bg-surface overflow-y-auto">
                <Materials session={session} onBack={() => setActiveTab(prevTab)} />
              </div>
            )}
          </div>
        </VideoChat>
      </div>
    </div>
  )
}

import ErrorBoundary from '../components/ErrorBoundary';
export default function SessionRoom() { return <ErrorBoundary><SessionRoomComponent /></ErrorBoundary>; }

