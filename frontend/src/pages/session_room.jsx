import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'

const TABS = ['Video', 'Chat', 'Compiler', 'Whiteboard', 'Materials', 'Notes']

export default function SessionRoom() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('Video')

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getSession(sessionId)
        setSession(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId])

  if (loading) return <div className="p-12 text-center text-ink/50">Loading session room...</div>

  if (error) return (
    <div className="max-w-xl mx-auto p-12 text-center mt-12">
      <p className="text-4xl mb-4">🚫</p>
      <h1 className="text-2xl font-display mb-2">Access Denied</h1>
      <p className="text-ink/60 mb-8">{error}</p>
      <Link to="/sessions" className="btn-primary">Back to Sessions</Link>
    </div>
  )

  // Block cancelled and completed sessions
  if (session.status === 'cancelled') {
    return (
      <div className="max-w-xl mx-auto p-12 text-center mt-12">
        <p className="text-4xl mb-4">❌</p>
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
  const peerName = isLearner ? session.tutor_name : session.learner_name
  const roleLabel = isLearner ? "You are learning" : "You are teaching"
  const req = session.request

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#FDFDFC] flex flex-col">
      {/* Header */}
      <header className="border-b border-line bg-white px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <h1 className="font-semibold text-lg capitalize">{session.skill}</h1>
            <span className="text-[10px] uppercase tracking-wider bg-moss/10 text-moss border border-moss/20 px-2 py-0.5 rounded font-medium">
              Live Room
            </span>
          </div>
          <p className="text-xs text-ink/50">
            {formatDate(session.session_date)} • {session.start_time} - {session.end_time} • with <span className="font-medium text-ink/80">{peerName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick link back to the text chat if they need it */}
          <Link to={`/chat/${session.request_id}`} className="btn-secondary text-xs py-1.5 px-4 mr-2">
            Open Chat
          </Link>
          <Link to="/sessions" className="btn-ghost text-xs text-ink/50 hover:bg-red-50 hover:text-red-600 transition-colors">
            Leave Room
          </Link>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Main Workspace */}
        <main className="flex-1 flex flex-col bg-[#FDFDFC]">
          {/* Tabs */}
          <div className="flex px-4 border-b border-line bg-white/50 pt-2 shrink-0 overflow-x-auto">
            {TABS.map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t ? 'border-moss text-ink' : 'border-transparent text-ink/40 hover:text-ink/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'Video' ? (
            <VideoChat sessionId={session.id} />
          ) : (
            <div className="flex-1 p-8 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-line/30 rounded-xl mx-auto mb-4 flex items-center justify-center text-2xl">
                  {activeTab === 'Chat' ? '💬' : activeTab === 'Compiler' ? '💻' : activeTab === 'Whiteboard' ? '📝' : activeTab === 'Materials' ? '📄' : '📋'}
                </div>
                <h2 className="font-medium mb-1">{activeTab}</h2>
                <p className="text-sm text-ink/50 leading-relaxed">
                  {activeTab === 'Chat' && 'Real-time collaborative chat will be available here.'}
                  {activeTab === 'Compiler' && 'Collaborative Python compiler will be available here.'}
                  {activeTab === 'Whiteboard' && 'Collaborative whiteboard will be available here.'}
                  {activeTab === 'Materials' && 'Learning materials will be available here.'}
                  {activeTab === 'Notes' && 'Session notes will be available here.'}
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right: Info Panel */}
        <aside className="w-80 border-l border-line bg-white shrink-0 overflow-y-auto p-5 space-y-6 hidden lg:block">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/40 font-semibold mb-3">Session Info</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink/50">Role</span>
                <span className="font-medium text-moss">{roleLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Tutor</span>
                <span className="font-medium">{session.tutor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Learner</span>
                <span className="font-medium">{session.learner_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">Status</span>
                <span className="font-medium capitalize">{session.status}</span>
              </div>
            </div>
            
            {session.notes && (
              <div className="mt-4 p-3 bg-paper rounded-lg text-sm border border-line">
                <p className="text-xs font-medium text-ink/60 mb-1">Agenda / Notes</p>
                <p className="text-ink/80">{session.notes}</p>
              </div>
            )}
          </div>

          {/* Context from Step 1 */}
          {req && (req.learner_current_level || req.learner_topics || req.learner_goals) && (
            <div className="pt-5 border-t border-line">
              <p className="text-[10px] uppercase tracking-wider text-ink/40 font-semibold mb-3">Learner Profile</p>
              <div className="space-y-4 text-sm">
                {req.learner_current_level && (
                  <div>
                    <p className="text-ink/50 text-xs mb-0.5">Current Level</p>
                    <p className="font-medium">{req.learner_current_level}</p>
                  </div>
                )}
                {req.learner_topics && (
                  <div>
                    <p className="text-ink/50 text-xs mb-0.5">Topics of interest</p>
                    <p className="font-medium">{req.learner_topics}</p>
                  </div>
                )}
                {req.learner_goals && (
                  <div>
                    <p className="text-ink/50 text-xs mb-0.5">Goals</p>
                    <p className="font-medium leading-relaxed">{req.learner_goals}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {req && (req.learner_can_teach || req.learner_teach_proficiency) && (
            <div className="pt-5 border-t border-line">
              <p className="text-[10px] uppercase tracking-wider text-ink/40 font-semibold mb-3">Learner Can Teach</p>
              <div className="space-y-4 text-sm">
                {req.learner_can_teach && (
                  <div>
                    <p className="text-ink/50 text-xs mb-0.5">Skills</p>
                    <p className="font-medium">{req.learner_can_teach}</p>
                  </div>
                )}
                {req.learner_teach_proficiency && (
                  <div>
                    <p className="text-ink/50 text-xs mb-0.5">Proficiency</p>
                    <p className="font-medium">{req.learner_teach_proficiency}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

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
