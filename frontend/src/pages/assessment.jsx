import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import './arena.css'

const STEPS = { PICK: 'pick', RULES: 'rules', QUIZ: 'quiz', RESULT: 'result', TERMINATED: 'terminated' }
const MAX_VIOLATIONS = 3

const RULES = [
  'Stay fullscreen — leaving it counts as a violation.',
  'Do not switch tabs or windows.',
  'Copying, pasting and right-click are disabled outside the code editor.',
  '3 violations end the exam and submit it automatically.',
  'The timer keeps running — the attempt cannot be restarted with new questions.',
]

const KIND_LABEL = {
  mcq: 'Multiple choice',
  output: 'Code tracing',
  debug: 'Debugging',
  coding: 'Problem solving',
}

const LEVELS = [
  { id: 'beginner', icon: '🌱', label: 'Beginner' },
  { id: 'intermediate', icon: '⚡', label: 'Intermediate' },
  { id: 'expert', icon: '🔥', label: 'Expert' },
]

/* ── Code editor ─────────────────────────────────────────────────────────────
   Behaviour is unchanged from the previous Arena: Tab inserts four spaces,
   copy/cut remember what left THIS editor, and a paste whose contents did not
   come from here is refused and counted as a violation. */
function LocalCompiler({ code, onChange, language, onViolation }) {
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const lastEditorTextRef = useRef('')

  const handleRun = async () => {
    setIsRunning(true)
    setError('')
    setOutput('')
    try {
      const res = await api.runArenaCode(code)
      if (res.error) setError(res.error)
      setOutput(res.output || '')
    } catch (err) {
      setError(err.message || 'Execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      onChange(code.substring(0, start) + '    ' + code.substring(end))
      setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 4 }, 0)
    }
  }

  const captureEditorText = (e) => {
    const ta = e.target
    lastEditorTextRef.current = code.substring(ta.selectionStart, ta.selectionEnd)
  }

  const handlePaste = (e) => {
    const clipboardText = e.clipboardData ? e.clipboardData.getData('text') : ''
    if (clipboardText !== lastEditorTextRef.current) {
      e.preventDefault()
      onViolation?.('Pasting external code is not allowed.')
    }
  }

  const isPython = !language || language.toLowerCase() === 'python'

  return (
    <div style={{ border: '2px solid #29251F', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 0 #29251F' }}>
      <div style={{ background: '#3A352D', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #29251F' }}>
        <span className="mono" style={{ color: '#F8F3E9', fontSize: 12, fontWeight: 700 }}>
          {isPython ? 'PYTHON 3' : `${language.toUpperCase()} · RUN SUPPORTS PYTHON 3`}
        </span>
        <button
          type="button"
          onClick={handleRun}
          aria-disabled={isRunning || !code.trim()}
          disabled={isRunning || !code.trim()}
          className="btn btn-p"
          style={{ minHeight: 36, padding: '0 14px', fontSize: 13, boxShadow: '0 3px 0 #29251F' }}
        >
          ▶ {isRunning ? 'Running…' : 'Run Code'}
        </button>
      </div>
      <textarea
        value={code}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onCopy={captureEditorText}
        onCut={captureEditorText}
        onPaste={handlePaste}
        spellCheck="false"
        placeholder="Write your code here…"
        className="mono"
        style={{ width: '100%', minHeight: 200, background: '#29251F', color: '#F8F3E9', padding: 16, fontSize: 14, lineHeight: 1.7, border: 'none', resize: 'vertical', display: 'block' }}
      />
      <div style={{ background: '#1F1C17', borderTop: '2px dashed #6E6455', padding: '12px 16px', minHeight: 90 }}>
        <span className="mono" style={{ color: '#B9AE9C', fontSize: 11, fontWeight: 700 }}>CONSOLE OUTPUT</span>
        <pre className="mono" style={{ color: error ? '#FF9B86' : '#D6F3EA', fontSize: 14, marginTop: 8, whiteSpace: 'pre-wrap' }}>
          {isRunning && !error && !output ? 'Executing…' : (error || output || 'Run your code to see output…')}
        </pre>
      </div>
    </div>
  )
}

export default function Assessment() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(STEPS.PICK)
  const [skillName, setSkillName] = useState('')
  const [role, setRole] = useState('teaching')
  const [level, setLevel] = useState('intermediate')
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [answers, setAnswers] = useState({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resumed, setResumed] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)

  // Security / anti-cheat
  const [violations, setViolations] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showWarning, setShowWarning] = useState(null) // { count, message }
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const lastViolation = useRef(0)

  // Timer — always seeded from the server's seconds_remaining, never a hardcoded
  // value, so a resumed attempt only gets the time actually left.
  const DEFAULT_TIME = 45 * 60
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME)

  // Called as the FIRST statement of a click handler (no await before it) so the
  // browser still counts it as part of the user gesture. Non-async on purpose.
  const requestFullscreenSync = () => {
    try {
      const el = document.documentElement
      const p = el.requestFullscreen ? el.requestFullscreen() : null
      if (p && typeof p.catch === 'function') {
        p.catch(err => console.warn('Fullscreen request blocked:', err))
      }
    } catch (err) {
      console.warn('Fullscreen request blocked:', err)
    }
  }

  const recordViolation = (msg) => {
    const now = Date.now()
    if (now - lastViolation.current > 2000) {
      lastViolation.current = now
      setViolations(v => {
        const newV = v + 1
        if (newV >= MAX_VIOLATIONS) {
          submitQuiz(true, newV) // terminate and auto-submit
          return newV
        }
        setShowWarning({ count: newV, message: msg })
        return newV
      })
    }
  }

  useEffect(() => {
    if (step === STEPS.QUIZ) {
      const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }

      const handleVisibilityBlur = () => {
        if (document.visibilityState === 'hidden' || !document.hasFocus()) {
          recordViolation('You left the Skill Arena window. Return immediately.')
        }
      }

      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          setIsFullscreen(false)
          recordViolation('Please return to Skill Arena fullscreen mode.')
        } else {
          setIsFullscreen(true)
        }
      }

      const isInsideEditor = (target) =>
        !!(target && target.closest && (target.closest('textarea') || target.closest('input')))

      const handleKeyDown = (e) => {
        const key = e.key.toLowerCase()
        const mod = e.ctrlKey || e.metaKey

        // Devtools shortcuts: always blocked, and counted as a violation.
        if (key === 'f12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
          e.preventDefault()
          recordViolation('Developer tools are disabled during the Skill Arena.')
          return
        }

        // Copy/cut/paste/select-all/print/save/view-source: blocked outside the editor only.
        if (!isInsideEditor(e.target) && mod && ['c', 'x', 'v', 'a', 'p', 's', 'u'].includes(key)) {
          e.preventDefault()
        }
      }

      window.addEventListener('blur', handleVisibilityBlur)
      document.addEventListener('visibilitychange', handleVisibilityBlur)
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      window.addEventListener('beforeunload', handleBeforeUnload)
      document.addEventListener('keydown', handleKeyDown)

      // requestFullscreen resolves asynchronously, so handleStartExam sets
      // isFullscreen optimistically. Verify against reality shortly after, so a
      // refused request still raises the "Fullscreen is required" gate.
      const fsCheck = setTimeout(() => setIsFullscreen(!!document.fullscreenElement), 1200)

      return () => {
        clearTimeout(fsCheck)
        window.removeEventListener('blur', handleVisibilityBlur)
        document.removeEventListener('visibilitychange', handleVisibilityBlur)
        document.removeEventListener('fullscreenchange', handleFullscreenChange)
        window.removeEventListener('beforeunload', handleBeforeUnload)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [step])

  const submitRef = useRef(submitQuiz)
  useEffect(() => { submitRef.current = submitQuiz })

  useEffect(() => {
    let timer
    if (step === STEPS.QUIZ && !loading) {
      timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer)
            setTimeout(() => submitRef.current(), 0)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (timer) clearInterval(timer) }
  }, [step, loading])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Phase 1: fetch the questions and show the rules screen. Fullscreen is NOT
  // requested here — by the time generation finishes the click gesture that
  // triggered this has expired and requestFullscreen() would be rejected.
  async function executeStartQuiz(skillToStart) {
    if (!skillToStart.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.startAssessment(skillToStart.trim(), level)
      setQuestions(res.questions)
      setAttemptId(res.attempt_id)
      const prefill = {}
      res.questions.forEach(q => {
        if (q.type === 'coding' && q.starter_code) prefill[q.id] = q.starter_code
      })
      setAnswers(prefill)
      setViolations(0)
      setTimeLeft(res.seconds_remaining ?? DEFAULT_TIME)
      setResumed(!!res.resumed)
      setCurrentQuestionIndex(0)
      setRulesAccepted(false)
      setStep(STEPS.RULES)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function startQuiz(e) {
    e?.preventDefault()
    executeStartQuiz(skillName)
  }

  // Phase 2: the rules screen's Start button. requestFullscreenSync() runs as the
  // very first statement, synchronously, still inside the click gesture.
  function handleStartExam() {
    requestFullscreenSync()
    setIsFullscreen(true) // optimistic — the effect below verifies against reality
    setCurrentQuestionIndex(0)
    setStep(STEPS.QUIZ)
  }

  useEffect(() => {
    const s = searchParams.get('skill')
    const r = searchParams.get('role')
    const auto = searchParams.get('autoStart') === 'true'
    if (s) setSkillName(s)
    if (r) setRole(r)
    if (s && auto) executeStartQuiz(s)
  }, [searchParams])

  async function submitQuiz(isTermination = false, violationsOverride = null) {
    if (loading) return
    setLoading(true)
    setError('')
    setShowSubmitConfirm(false)
    try {
      const payload = {
        skill_name: skillName.trim(),
        role,
        attempt_id: attemptId,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
        violations: violationsOverride ?? violations,
        terminated: isTermination,
      }
      const res = await api.submitAssessment(payload)
      setResult(res)
      setStep(isTermination ? STEPS.TERMINATED : STEPS.RESULT)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const answeredCount = Object.keys(answers).filter(k => {
    const v = answers[k]
    return v !== undefined && v !== null && String(v).trim() !== ''
  }).length
  const totalCount = questions.length
  const progress = totalCount > 0 ? Math.round(((currentQuestionIndex + 1) / totalCount) * 100) : 0

  const handleNext = () => { if (currentQuestionIndex < totalCount - 1) setCurrentQuestionIndex(i => i + 1) }
  const handlePrev = () => { if (currentQuestionIndex > 0) setCurrentQuestionIndex(i => i - 1) }

  const currentQuestion = questions[currentQuestionIndex]
  const qType = currentQuestion ? (currentQuestion.type || 'mcq').toLowerCase() : 'mcq'
  const isCode = qType === 'coding'
  const isLast = currentQuestionIndex === totalCount - 1
  const lowTime = timeLeft <= 60

  const setAnswer = (qid, value) => setAnswers(a => ({ ...a, [qid]: value }))

  const ErrorBanner = () => error ? (
    <div style={{ padding: '12px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 800 }}>
      {error}
    </div>
  ) : null

  return (
    <div className="sv-arena">

      {/* ============ PICK ============ */}
      {step === STEPS.PICK && (
        <div className="two" style={{ maxWidth: 1120, margin: '0 auto', padding: '48px clamp(16px, 3vw, 32px) 80px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 40, alignItems: 'start' }}>
          <form className="card" onSubmit={startQuiz} style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="pill" style={{ alignSelf: 'flex-start', background: 'var(--accl)' }}>⚔ SKILL ARENA</span>
              <h1 style={{ margin: 0, fontSize: 44, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-1px' }}>Enter the Skill Arena</h1>
              <p className="muted" style={{ margin: 0, fontSize: 17 }}>Prove your mastery. You will enter a focused, fullscreen environment.</p>
            </div>

            <ErrorBanner />

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Skill name</span>
              <input className="in" value={skillName} onChange={e => setSkillName(e.target.value)} placeholder="e.g. Python, Java, DSA, Web Development" />
            </label>

            <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <legend style={{ fontWeight: 700, fontSize: 14, padding: '0 0 10px' }}>Difficulty</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {LEVELS.map(l => (
                  <button key={l.id} type="button" onClick={() => setLevel(l.id)} aria-pressed={level === l.id} className={`choice${level === l.id ? ' on' : ''}`}>
                    <span style={{ fontSize: 22 }}>{l.icon}</span><strong>{l.label}</strong>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 14, padding: '0 0 10px' }}>Arena goal</legend>
              <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button type="button" onClick={() => setRole('teaching')} aria-pressed={role === 'teaching'} className={`choice${role === 'teaching' ? ' on' : ''}`}>
                  <span style={{ fontSize: 22 }}>🎓</span><strong>I want to teach it</strong>
                  <span className="muted" style={{ fontSize: 13 }}>Get a verified teaching badge</span>
                </button>
                <button type="button" onClick={() => setRole('learning')} aria-pressed={role === 'learning'} className={`choice${role === 'learning' ? ' on' : ''}`}>
                  <span style={{ fontSize: 22 }}>📚</span><strong>I’m learning it</strong>
                  <span className="muted" style={{ fontSize: 13 }}>See where I stand as a learner</span>
                </button>
              </div>
            </fieldset>

            <button type="submit" className="btn btn-p" aria-disabled={loading || !skillName.trim()} disabled={loading || !skillName.trim()} style={{ width: '100%' }}>
              {loading
                ? <><span className="mono" style={{ letterSpacing: 3 }}>▮▮▮</span> Generating your questions…</>
                : <>Enter Arena →</>}
            </button>
          </form>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 24, background: '#29251F', color: '#FFFDF8', boxShadow: '0 4px 0 var(--accd), 0 7px 0 #29251F', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: '#D9CBB2' }}>WHAT’S INSIDE</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ border: '2px solid #FFFDF8', borderRadius: 12, padding: 12 }}>
                  <div className="mono" style={{ fontSize: 30, fontWeight: 700 }}>20</div>
                  <span style={{ fontSize: 13, color: '#D9CBB2', fontWeight: 700 }}>questions</span>
                </div>
                <div style={{ border: '2px solid #FFFDF8', borderRadius: 12, padding: 12 }}>
                  <div className="mono" style={{ fontSize: 30, fontWeight: 700 }}>2</div>
                  <span style={{ fontSize: 13, color: '#D9CBB2', fontWeight: 700 }}>coding tasks</span>
                </div>
                <div style={{ border: '2px solid #FFFDF8', borderRadius: 12, padding: 12, gridColumn: 'span 2', background: 'var(--acc)', color: '#29251F' }}>
                  <div className="mono" style={{ fontSize: 30, fontWeight: 700 }}>45:00</div>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>minutes, one sitting</span>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 22, background: '#FBEFC4', transform: 'rotate(-1deg)' }}>
              <span className="eb" style={{ color: '#29251F' }}>TIP</span>
              <p style={{ margin: '8px 0 0', fontWeight: 700, lineHeight: 1.5 }}>The Skill Arena works best on a laptop or desktop. Close other tabs before you start.</p>
            </div>
          </aside>
        </div>
      )}

      {/* ============ RULES ============ */}
      {step === STEPS.RULES && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 16px 80px' }}>
          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span className="pill" style={{ alignSelf: 'flex-start', background: '#F6DDD8' }}>🛡 BEFORE YOU BEGIN</span>
            <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900 }}>Arena rules</h1>
            {resumed && (
              <div style={{ padding: '12px 14px', border: '2px solid #29251F', borderRadius: 12, background: '#FBEFC4', fontWeight: 600, fontSize: 14 }}>
                Resuming your attempt — the timer kept running while you were away.
              </div>
            )}
            <ErrorBanner />
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RULES.map((r, i) => (
                <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', border: '2px solid #29251F', borderRadius: 12, background: '#F8F3E9', fontWeight: 600 }}>
                  <span className="key" style={{ background: 'var(--accl)' }}>{i + 1}</span>{r}
                </li>
              ))}
            </ol>
            <label style={{ display: 'flex', gap: 12, alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={rulesAccepted} onChange={e => setRulesAccepted(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
              <span aria-hidden="true" style={{ width: 26, height: 26, border: '2px solid #29251F', borderRadius: 7, background: rulesAccepted ? 'var(--acc)' : '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, boxShadow: '0 2px 0 #29251F' }}>
                {rulesAccepted ? '✓' : ''}
              </span>
              I understand and agree to these rules.
            </label>
            <button type="button" onClick={handleStartExam} aria-disabled={!rulesAccepted} disabled={!rulesAccepted} className="btn btn-p" style={{ width: '100%' }}>
              ⛶ Start Exam (Fullscreen)
            </button>
          </div>
        </div>
      )}

      {/* ============ QUIZ ============ */}
      {step === STEPS.QUIZ && currentQuestion && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
          <header style={{ background: '#FFFDF8', borderBottom: '2px solid #29251F', boxShadow: '0 4px 0 #D2BEA0', padding: '14px clamp(16px, 3vw, 32px)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="eb" style={{ fontSize: 11 }}>⚔ SKILL ARENA</span>
              <span style={{ fontSize: 20, fontWeight: 900 }}>{skillName}</span>
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Question {currentQuestionIndex + 1} of {totalCount}</span>
              <div style={{ width: '100%', maxWidth: 360, height: 12, border: '2px solid #29251F', borderRadius: 999, background: '#F0E5D2', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${progress}%`, background: 'var(--acc)', transition: 'width 240ms ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {violations > 0 && (
                <span className="pill" style={{ background: '#F6DDD8', color: '#9A2B1E', borderColor: '#9A2B1E', height: 36 }}>
                  ⚠ {violations} / {MAX_VIOLATIONS} violations
                </span>
              )}
              <span className="pill mono" style={{ height: 36, background: lowTime ? '#E2533A' : '#FFFDF8', color: lowTime ? '#FFFDF8' : '#29251F', borderColor: lowTime ? '#9A2B1E' : '#29251F' }}>
                ◷ {formatTime(timeLeft)}
              </span>
            </div>
          </header>

          <main style={{ flex: 1, padding: '32px clamp(16px, 3vw, 32px)' }}>
            <div className="card" style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(22px, 4vw, 40px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {currentQuestion.topic && <span className="pill">Topic: {currentQuestion.topic}</span>}
                <span className="pill" style={{ background: 'var(--accl)' }}>{KIND_LABEL[qType] || qType}</span>
              </div>

              {!isCode && (
                <>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.5 }}>{currentQuestion.question}</h2>
                  {currentQuestion.code && (
                    <pre className="mono" style={{ padding: '18px 20px', border: '2px solid #29251F', borderRadius: 12, background: '#29251F', color: '#F8F3E9', fontSize: 15, lineHeight: 1.6, overflowX: 'auto' }}>
                      {currentQuestion.code}
                    </pre>
                  )}
                  <div role="radiogroup" aria-label="Answer options" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(currentQuestion.options || []).map((opt, i) => {
                      const selected = answers[currentQuestion.id] === i || answers[currentQuestion.id] === String(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAnswer(currentQuestion.id, i)}
                          className={`opt${selected ? ' on' : ''}`}
                        >
                          <span className="key">{String.fromCharCode(65 + i)}</span>{opt}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {isCode && (
                <>
                  {currentQuestion.title && <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{currentQuestion.title}</h3>}
                  <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55 }}>{currentQuestion.question}</p>
                  <div style={{ padding: '14px 16px', border: '2px solid #29251F', borderRadius: 12, background: '#F8F3E9', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
                    {currentQuestion.function_name && (
                      <span><strong>Function name:</strong> <code className="mono">{currentQuestion.function_name}</code></span>
                    )}
                    {currentQuestion.example && (
                      <span><strong>Example:</strong> <code className="mono">{currentQuestion.example}</code></span>
                    )}
                    <span className="muted" style={{ fontSize: 13 }}>
                      {currentQuestion.test_count
                        ? `Checked against ${currentQuestion.test_count} test cases. Partial credit is given for passing some but not all.`
                        : 'Checked against hidden test cases. Partial credit is given for passing some but not all.'}
                    </span>
                  </div>
                  <LocalCompiler
                    code={answers[currentQuestion.id] ?? currentQuestion.starter_code ?? ''}
                    onChange={v => setAnswer(currentQuestion.id, v)}
                    language={skillName}
                    onViolation={recordViolation}
                  />
                </>
              )}
            </div>
          </main>

          <footer style={{ background: '#FFFDF8', borderTop: '2px solid #29251F', padding: '14px clamp(16px, 3vw, 32px)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" className="btn btn-s" onClick={handlePrev} aria-disabled={currentQuestionIndex === 0} disabled={currentQuestionIndex === 0}>← Previous</button>
            <div className="hide-m" style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              {questions.map((q, i) => {
                const isCurrent = i === currentQuestionIndex
                const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== ''
                return (
                  <button
                    key={q.id}
                    type="button"
                    className="qd"
                    onClick={() => setCurrentQuestionIndex(i)}
                    aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ', not answered'}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    style={isCurrent
                      ? { background: '#29251F', color: '#FFFDF8' }
                      : isAnswered ? { background: 'var(--accl)' } : undefined}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            {!isLast && <button type="button" className="btn btn-s" onClick={handleNext} style={{ marginLeft: 'auto' }}>Next →</button>}
            {isLast && <button type="button" className="btn btn-p" onClick={() => setShowSubmitConfirm(true)} style={{ marginLeft: 'auto' }}>Submit Arena →</button>}
          </footer>

          {/* ---- violation warning ---- */}
          {showWarning && (
            <div className="scrim">
              <div className="card modal" role="alertdialog" aria-labelledby="sv-warn">
                <span className="tile" style={{ background: '#F6DDD8', color: '#9A2B1E' }}>!</span>
                <h3 id="sv-warn" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Violation {showWarning.count} of {MAX_VIOLATIONS}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 16 }}>{showWarning.message}</p>
                <div style={{ width: '100%', display: 'flex', gap: 6 }}>
                  {Array.from({ length: MAX_VIOLATIONS }).map((_, i) => (
                    <span key={i} style={{ flex: 1, height: 10, borderRadius: 5, border: '2px solid #29251F', background: i < showWarning.count ? '#E2533A' : '#FFFDF8' }} />
                  ))}
                </div>
                <div style={{ width: '100%', padding: '10px 12px', border: '2px solid #9A2B1E', borderRadius: 10, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 800 }}>
                  {MAX_VIOLATIONS - showWarning.count === 1
                    ? 'One more violation will end your exam.'
                    : `${MAX_VIOLATIONS - showWarning.count} more violations will end your exam.`}
                </div>
                <button type="button" className="btn btn-p" style={{ width: '100%' }} onClick={() => { setShowWarning(null); if (!document.fullscreenElement) requestFullscreenSync() }}>
                  Acknowledge and Continue
                </button>
              </div>
            </div>
          )}

          {/* ---- fullscreen required ---- */}
          {!showWarning && !isFullscreen && (
            <div className="scrim" style={{ background: 'rgba(248,243,233,.94)' }}>
              <div className="card modal" role="alertdialog" aria-labelledby="sv-fs">
                <span className="tile" style={{ background: 'var(--accl)' }}>⛶</span>
                <h3 id="sv-fs" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Fullscreen is required</h3>
                <p className="muted" style={{ margin: 0, fontSize: 16 }}>The Skill Arena can only be answered in fullscreen mode.</p>
                <button type="button" className="btn btn-p" style={{ width: '100%' }} onClick={requestFullscreenSync}>Click to continue</button>
              </div>
            </div>
          )}

          {/* ---- submit confirmation ---- */}
          {showSubmitConfirm && (
            <div className="scrim">
              <div className="card modal" role="dialog" aria-labelledby="sv-confirm">
                <h3 id="sv-confirm" style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Submit Arena?</h3>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  You answered <span className="mono" style={{ fontWeight: 700 }}>{answeredCount}</span> of <span className="mono" style={{ fontWeight: 700 }}>{totalCount}</span> questions.
                </p>
                {answeredCount < totalCount && (
                  <div style={{ width: '100%', padding: '10px 12px', border: '2px solid #9A2B1E', borderRadius: 10, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 800 }}>
                    {totalCount - answeredCount} question{totalCount - answeredCount === 1 ? '' : 's'} remaining!
                  </div>
                )}
                <span className="muted" style={{ fontSize: 13 }}>Once submitted, you cannot modify your answers.</span>
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <button type="button" className="btn btn-s" style={{ flex: 1 }} onClick={() => setShowSubmitConfirm(false)}>Cancel</button>
                  <button type="button" className="btn btn-p" style={{ flex: 1 }} aria-disabled={loading} disabled={loading} onClick={() => submitQuiz(false)}>
                    {loading ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ TERMINATED ============ */}
      {step === STEPS.TERMINATED && (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundImage: 'repeating-linear-gradient(-45deg, #F8F3E9 0 22px, #F2E9DA 22px 44px)' }}>
          <div className="card modal" style={{ maxWidth: 520, boxShadow: '0 4px 0 #9A2B1E, 0 7px 0 #29251F' }}>
            <span className="tile" style={{ background: '#E2533A', color: '#FFFDF8' }}>🛡</span>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>Skill Arena terminated</h1>
            <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
              Your Skill Arena was closed because the maximum number of security violations ({MAX_VIOLATIONS}) was reached. Your attempt has been recorded and submitted.
            </p>
            <span className="pill" style={{ background: '#F6DDD8', color: '#9A2B1E', borderColor: '#9A2B1E' }}>
              {MAX_VIOLATIONS} security violations were recorded during this attempt
            </span>
            <button type="button" className="btn btn-p" style={{ width: '100%' }} onClick={() => setStep(STEPS.RESULT)} aria-disabled={!result} disabled={!result}>
              View Result
            </button>
          </div>
        </div>
      )}

      {/* ============ RESULT ============ */}
      {step === STEPS.RESULT && result && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px clamp(16px, 3vw, 32px) 80px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span className="pill" style={{ background: '#D6F3EA' }}>✓ ARENA COMPLETE</span>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 900 }}>{skillName}</h1>
            <span className="muted">Your assessment is verified.</span>
            {result.violations > 0 && (
              <span className="pill" style={{ background: '#F6DDD8', color: '#9A2B1E', borderColor: '#9A2B1E' }}>
                {result.violations} security violation{result.violations === 1 ? ' was' : 's were'} recorded during this attempt
              </span>
            )}
          </div>

          <div className="card two" style={{ padding: 32, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' }}>
            <div style={{ width: 180, height: 180, borderRadius: 999, border: '2px solid #29251F', background: `conic-gradient(var(--acc) 0 ${Math.round(result.score)}%, #F0E5D2 ${Math.round(result.score)}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 0 #29251F' }}>
              <div style={{ width: 128, height: 128, borderRadius: 999, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="mono" style={{ fontSize: 40, fontWeight: 700 }}>{Math.round(result.score)}<span style={{ fontSize: 20 }}>%</span></span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {result.badge && <span className="pill" style={{ background: '#FBEFC4', height: 36, fontSize: 14 }}>🥇 {result.badge} badge</span>}
                {result.level && <span className="pill" style={{ height: 36, fontSize: 14 }}>{result.level}</span>}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
                Your score, level and badge are now on your profile. Peers searching for {skillName} can see your verified badge.
              </p>
            </div>
          </div>

          <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eb">◎ NEXT MOVE</span>
              {result.weak_topics?.length > 0 ? (
                <>
                  <strong style={{ fontSize: 20 }}>Focus on {result.weak_topics[0]}</strong>
                  <span className="muted">Master this to level up your overall {skillName} skill.</span>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: 20 }}>You’re solid across the board</strong>
                  <span className="muted">Consider teaching this skill to someone else.</span>
                </>
              )}
            </div>
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eb">↗ PATH AHEAD</span>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontWeight: 600 }}>
                {(result.study_plan || []).map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <Link to="/gamification" className="btn btn-p" style={{ minWidth: 320 }}>Continue your Skill Journey ▶</Link>
            <Link to="/marketplace" style={{ fontWeight: 800, fontSize: 14 }}>or find a partner in the Marketplace</Link>
          </div>
        </div>
      )}
    </div>
  )
}
