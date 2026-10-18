import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import VideoChat from '../components/VideoChat'
import Compiler from '../components/Compiler'
import Whiteboard from '../components/Whiteboard'
import Materials from '../components/Materials'
import Notes from '../components/Notes'
import ErrorBoundary from '../components/ErrorBoundary'
import './session_room.css'

const TOOLS = [
  { id: 'code', label: 'Code', ic: '⌨' },
  { id: 'board', label: 'Board', ic: '✎' },
  { id: 'split', label: 'Board + Code', ic: '◫' },
  { id: 'notes', label: 'Notes', ic: '☰' },
  { id: 'files', label: 'Files', ic: '⇪' },
]

function SessionRoomComponent() {
  const { sessionId } = useParams()
  const user = getSessionUser()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [req, setReq] = useState(null)
  const [error, setError] = useState(null)
  const [tool, setTool] = useState('split')
  const [timeLeft, setTimeLeft] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notesData, setNotesData] = useState({
    topics_discussed: "",
    topics_completed: "",
    learning_notes: ""
  })
  const [isCompleted, setIsCompleted] = useState(false)
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [completeError, setCompleteError] = useState('')

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
        } catch {
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
    <div className="sv-room" style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div className="card" style={{ maxWidth: 440, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#F6DDD8', color: '#9A2B1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, boxShadow: '0 5px 0 #29251F' }}>!</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Session error</h2>
        <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{error}</p>
        <Link to="/sessions" className="btn btn-p" style={{ minHeight: 48 }}>Back to sessions</Link>
      </div>
    </div>
  )

  if (!session) return (
    <div className="sv-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <p className="muted" style={{ fontWeight: 700 }}>Loading session…</p>
    </div>
  )

  const isTutor = user.id === session.tutor_id
  const peerName = isTutor ? session.learner_name : session.tutor_name

  // The room opens 15 minutes before the start (the server enforces this too).
  const opensAt = session.scheduled_start ? new Date(new Date(session.scheduled_start).getTime() - 15 * 60000) : null
  if (session.status === 'scheduled' && opensAt && new Date() < opensAt) {
    return (
      <div className="sv-room" style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div className="card" style={{ maxWidth: 440, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#FBEFC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, boxShadow: '0 5px 0 #29251F' }}>◷</span>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Too early to join</h2>
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
            This room opens at {opensAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}, 15 minutes before the session starts.
          </p>
          <Link to="/sessions" className="btn btn-p" style={{ minHeight: 48 }}>Back to sessions</Link>
        </div>
      </div>
    )
  }

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
    setCompleting(true)
    try {
      await api.saveSessionNotes(sessionId, notesData)
      await api.completeSessionProgress(sessionId)
      setIsCompleted(true)
      setConfirmOpen(false)
      if (session?.request_id) {
        navigate(`/quest-review/${sessionId}`)
      } else if (req?.id) {
        navigate(`/quest-review/${sessionId}`)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      // Keep the room open (e.g. "both of you need to join first") and show
      // the reason inside the dialog instead of replacing the whole page.
      setCompleteError(err.message || 'Could not complete the session.')
      setCompleting(false)
    }
  }

  const lowTime = !!timeLeft && Number(String(timeLeft).split(':')[0]) < 5
  const whenLabel = session.scheduled_start
    ? `${formatDate(session.scheduled_start)} · ${formatTime(session.scheduled_start)} – ${formatTime(session.scheduled_end)}`
    : `Today · ${session.start_time || 'Now'}`

  const show = {
    code: tool === 'code' || tool === 'split',
    board: tool === 'board' || tool === 'split',
    notes: tool === 'notes',
    files: tool === 'files',
  }

  return (
    <div className="sv-room">
      {/* ── header ── */}
      <header style={{ flex: 'none', background: '#FFFDF8', borderBottom: '2px solid #29251F', boxShadow: '0 4px 0 #D2BEA0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, border: '2px solid #29251F', background: 'var(--acc)', boxShadow: '0 2px 0 #29251F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>⚑</span>
          <div>
            <div className="eb">LEARNING ARENA</div>
            <strong style={{ fontSize: 17, textTransform: 'capitalize' }}>
              {session.skill_name || session.skill} <span className="muted" style={{ fontWeight: 700, textTransform: 'none' }}>with {peerName}</span>
            </strong>
          </div>
        </div>

        <span className="pill" style={{ background: isTutor ? '#D6F3EA' : '#E6DDF6' }}>{isTutor ? 'Teaching' : 'Learning'}</span>

        <div style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="pill mono" style={{ height: 36 }}>{whenLabel}</span>
          {timeLeft && !isCompleted && (
            <span className="pill mono" style={{ height: 36, fontSize: 13, ...(lowTime ? { background: '#E2533A', color: '#FFFDF8' } : { background: '#FFFDF8' }) }}>
              ◷ Ends in {timeLeft}
            </span>
          )}
        </div>

        <button type="button" className="btn btn-s" onClick={handleLeave}>Leave</button>
        {!isCompleted && (
          <button type="button" className="btn btn-p" disabled={completing} onClick={() => setConfirmOpen(true)}>
            ✓ Complete Session
          </button>
        )}
      </header>

      {/* ── body: workspace + video sidebar (the sidebar is VideoChat's own) ── */}
      <div className="body" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <VideoChat sessionId={session.id} onLeave={handleLeave}>
          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px', minHeight: 0 }}>

            {session.notes && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#FBEFC4', flexWrap: 'wrap', flex: 'none' }}>
                <span className="eb" style={{ color: '#29251F' }}>TODAY’S QUEST</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{session.notes}</span>
              </div>
            )}

            <div className="tools" role="tablist" aria-label="Session tools" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 5, border: '2px solid #29251F', borderRadius: 14, background: '#F0E5D2', boxShadow: 'inset 0 3px 0 #E2D3BB', flex: 'none' }}>
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tool === t.id}
                  className={`ttab${tool === t.id ? ' on' : ''}`}
                  onClick={() => setTool(t.id)}
                >
                  <span aria-hidden="true">{t.ic}</span>{t.label}
                </button>
              ))}
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, paddingRight: 8 }}>Tools stay live when you switch</span>
            </div>

            {/* Every tool stays mounted; only the inactive ones are hidden, so the
                whiteboard drawing and the compiler's shared socket survive a switch. */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>

              <section
                className={`pane${show.board ? '' : ' off'}`}
                aria-label="Whiteboard"
                aria-hidden={!show.board}
                style={{ position: 'relative', overflow: 'hidden', background: '#FFFDF8', backgroundImage: 'radial-gradient(#E2D3BB 1.3px, transparent 1.3px)', backgroundSize: '20px 20px', border: '2px solid #29251F', borderRadius: 16, boxShadow: '0 4px 0 #D2BEA0, 0 7px 0 #29251F' }}
              >
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Whiteboard sessionId={session.id} />
                </div>
                <span className="pill" style={{ position: 'absolute', left: 14, bottom: 14, background: '#D6F3EA', zIndex: 3, pointerEvents: 'none' }}>
                  ● Synced with {(peerName || '').split(' ')[0]}
                </span>
              </section>

              <section
                className={`pane${show.code ? '' : ' off'}`}
                aria-label="Code compiler"
                aria-hidden={!show.code}
                style={{ flexDirection: 'column', border: '2px solid #29251F', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 0 #29251F', background: '#29251F' }}
              >
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <Compiler sessionId={session.id} />
                </div>
              </section>

              <section
                className={`pane${show.notes ? '' : ' off'}`}
                aria-label="Session notes"
                aria-hidden={!show.notes}
                style={{ flexDirection: 'column', gap: 14, padding: 20, overflow: 'auto', background: '#FFFDF8', border: '2px solid #29251F', borderRadius: 16, boxShadow: '0 4px 0 #D2BEA0, 0 7px 0 #29251F' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Session notes</h2>
                  <span className="pill" style={{ background: '#D6F3EA' }}>Saved with Complete</span>
                </div>
                {notesLoaded && (
                  <Notes session={session} data={notesData} onChange={setNotesData} isCompleted={isCompleted} />
                )}
                <div style={{ marginTop: 'auto', padding: 14, border: '2px solid #29251F', borderRadius: 12, background: '#F8F3E9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="eb" style={{ color: '#29251F' }}>BEFORE YOU FINISH</span>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                    Fill in your notes, then press <strong>Complete Session</strong>. Your skill progress updates and you’ll get an AI recap.
                  </span>
                </div>
              </section>

              <section
                className={`pane${show.files ? '' : ' off'}`}
                aria-label="Materials"
                aria-hidden={!show.files}
                style={{ flexDirection: 'column', overflow: 'auto', background: '#FFFDF8', border: '2px solid #29251F', borderRadius: 16, boxShadow: '0 4px 0 #D2BEA0, 0 7px 0 #29251F' }}
              >
                <Materials session={session} />
              </section>

            </div>
          </main>
        </VideoChat>
      </div>

      {/* ── complete confirm ── */}
      {confirmOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(41,37,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 }}>
          <div className="card" role="alertdialog" aria-labelledby="sv-cm" style={{ maxWidth: 460, width: '100%', padding: 30, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#D6F3EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, boxShadow: '0 5px 0 #29251F' }}>✓</span>
            <h3 id="sv-cm" style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Complete this session?</h3>
            <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
              Your notes will be saved and your <strong style={{ color: '#29251F', textTransform: 'capitalize' }}>{session.skill_name || session.skill} progress</strong> will update. This can’t be undone.
            </p>
            {completeError && (
              <div role="alert" style={{ width: '100%', padding: '10px 12px', border: '2px solid #9A2B1E', borderRadius: 10, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 800, fontSize: 13, textAlign: 'left' }}>
                {completeError}
              </div>
            )}
            {!notesData.learning_notes.trim() && (
              <div style={{ width: '100%', padding: '10px 12px', border: '2px solid #29251F', borderRadius: 10, background: '#FBEFC4', fontWeight: 700, fontSize: 13, textAlign: 'left' }}>
                ⚠ “My Learning Notes” is empty — add a line before finishing?
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button type="button" className="btn btn-s" style={{ flex: 1, minHeight: 50 }} onClick={() => { setConfirmOpen(false); setCompleteError('') }}>Keep working</button>
              <button type="button" className="btn btn-p" style={{ flex: 1, minHeight: 50 }} disabled={completing} onClick={handleComplete}>
                {completing ? 'Completing…' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SessionRoom() {
  return <ErrorBoundary><SessionRoomComponent /></ErrorBoundary>
}
