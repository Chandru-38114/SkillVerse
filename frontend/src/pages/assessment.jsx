import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import ArenaResultInsights from '../components/ArenaResultInsights'
import LazyCodeEditor from '../components/code/LazyCodeEditor'
import JudgeResults from '../components/code/JudgeResults'
import SqlTable from '../components/code/SqlTable'
import { LANGUAGE_LABELS } from '../components/code/languages'
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

// The server sends a coding question's example as an OBJECT
// ({ args: [...], expected: ... }). Rendering an object as a React child throws
// and blanks the page, so turn it into the one-line form the design shows:
//   second_largest([4, 1, 4, 3]) should return 3
function formatExample(q) {
  const ex = q && q.example
  if (!ex || typeof ex !== 'object') return null
  const show = (v) => { try { return JSON.stringify(v) } catch { return String(v) } }
  const args = Array.isArray(ex.args) ? ex.args : []
  return `${q.function_name || 'solve'}(${args.map(show).join(', ')}) should return ${show(ex.expected)}`
}

// Code-tracing and debugging items arrive with the snippet appended to the
// question text after a blank line. Split it back out so the snippet renders in
// the design's dark code block instead of running into the prompt.
function splitQuestion(text) {
  const t = String(text == null ? '' : text)
  const i = t.indexOf('\n\n')
  if (i === -1) return { prompt: t, code: null }
  return { prompt: t.slice(0, i).trim(), code: t.slice(i + 2).trim() || null }
}

/* ── Code editor ─────────────────────────────────────────────────────────────
   Monaco (the VS Code / LeetCode editor): auto-indent, bracket closing, colours.
   Arena rule kept from before: copy/cut remember what left THIS editor, and a
   paste whose contents did not come from here is refused and counted as a
   violation (right-click and drag-drop are off too).
   Run tests the answer on the question's examples; hidden tests run on Submit.
   The answer is sent as JSON {language, code}. */
function ArenaCodeEditor({ q, value, onChange, attemptId, onViolation, draftsRef }) {
  const langs = q.languages && q.languages.length ? q.languages : ['python']
  const parsed = parseCodeAnswer(value, q)
  const [result, setResult] = useState(null)
  const [resultId, setResultId] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const setCode = (code) => {
    draftsRef.current[`${q.id}:${parsed.language}`] = code
    onChange(JSON.stringify({ language: parsed.language, code }))
  }
  const switchLanguage = (lang) => {
    draftsRef.current[`${q.id}:${parsed.language}`] = parsed.code
    const code = draftsRef.current[`${q.id}:${lang}`] ?? q.starter?.[lang] ?? ''
    onChange(JSON.stringify({ language: lang, code }))
    setResult(null)
  }

  const handleRun = async () => {
    if (isRunning) return
    setIsRunning(true)
    try {
      setResult(await api.arenaRunCode(attemptId, q.id, parsed.language, parsed.code))
    } catch (err) {
      setResult({ verdict: 'Error', passed: 0, total: 0, results: [], error: err.message || 'Execution failed' })
    } finally {
      setResultId(n => n + 1)
      setIsRunning(false)
    }
  }

  return (
    <div style={{ border: '2px solid #29251F', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 0 #29251F' }}>
      <div style={{ background: '#3A352D', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '2px solid #29251F' }}>
        {langs.length > 1 ? (
          <select
            aria-label="Language"
            value={parsed.language}
            onChange={e => switchLanguage(e.target.value)}
            style={{ height: 34, borderRadius: 8, border: '2px solid #29251F', background: '#FFFDF8', fontWeight: 800, fontSize: 13, padding: '0 8px' }}
          >
            {langs.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l] || l}</option>)}
          </select>
        ) : (
          <span className="mono" style={{ color: '#F8F3E9', fontSize: 12, fontWeight: 700 }}>{(LANGUAGE_LABELS[langs[0]] || langs[0]).toUpperCase()}</span>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="mono hide-m" style={{ color: '#B9AE9C', fontSize: 11 }}>Ctrl + Enter = Run</span>
          <button
            type="button"
            onClick={handleRun}
            aria-disabled={isRunning || !parsed.code.trim()}
            disabled={isRunning || !parsed.code.trim()}
            className="btn btn-p"
            style={{ minHeight: 36, padding: '0 14px', fontSize: 13, boxShadow: '0 3px 0 #29251F' }}
          >
            ▶ {isRunning ? 'Running…' : 'Run examples'}
          </button>
        </div>
      </div>
      <LazyCodeEditor
        key={`${q.id}:${parsed.language}`}
        height={340}
        theme="dark"
        language={parsed.language}
        value={parsed.code}
        onChange={setCode}
        onRun={handleRun}
        restrictPaste
        onViolation={onViolation}
        ariaLabel={`${LANGUAGE_LABELS[parsed.language] || parsed.language} answer editor`}
      />
      <div style={{ borderTop: '2px dashed #6E6455' }}>
        <JudgeResults key={resultId} result={result} running={isRunning} emptyText="Run your code to check it on the examples. Hidden tests are checked when you submit." />
      </div>
    </div>
  )
}

// A coding answer is JSON {language, code}; before the first edit it is the starter code.
function parseCodeAnswer(value, q) {
  const langs = q.languages && q.languages.length ? q.languages : ['python']
  if (value) {
    try {
      const v = JSON.parse(value)
      if (v && typeof v.code === 'string') return { language: langs.includes(v.language) ? v.language : langs[0], code: v.code }
    } catch { /* plain code from an older client */ }
    return { language: langs[0], code: String(value) }
  }
  return { language: langs[0], code: q.starter?.[langs[0]] ?? q.starter_code ?? '' }
}

// The result score counts up from 0 once, for a bit of celebration.
function CountUp({ to, ms = 900 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms)
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return n
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
  const codeDraftsRef = useRef({})   // per question + language, so switching language keeps your code

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

      // Leaving the exam INSIDE the site (navbar links, the browser's Back
      // button) used to be possible without any violation: the page never
      // lost focus and fullscreen stayed on. During the exam the navbar is
      // hidden, every link click is blocked, and Back stays on the exam.
      const handleLinkClick = (e) => {
        const link = e.target.closest && e.target.closest('a[href]')
        if (!link) return
        e.preventDefault()
        e.stopPropagation()
        recordViolation('Leaving the Skill Arena during the exam is not allowed.')
      }
      const handleBack = () => {
        window.history.pushState(null, '', window.location.href)
        recordViolation('Leaving the Skill Arena during the exam is not allowed.')
      }
      document.body.classList.add('sv-arena-lock')
      window.history.pushState(null, '', window.location.href)
      document.addEventListener('click', handleLinkClick, true)
      window.addEventListener('popstate', handleBack)

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
        document.body.classList.remove('sv-arena-lock')
        document.removeEventListener('click', handleLinkClick, true)
        window.removeEventListener('popstate', handleBack)
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
  // The timer auto-submits only ONCE. If that submit fails, the student sees
  // the error and can press Submit again — it used to retry every second.
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    let timer
    if (step === STEPS.QUIZ && !loading) {
      timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer)
            if (!autoSubmittedRef.current) {
              autoSubmittedRef.current = true
              setTimeout(() => submitRef.current(), 0)
            }
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
      const res = await api.startAssessment(skillToStart.trim(), level, role)
      setQuestions(res.questions)
      setAttemptId(res.attempt_id)
      const prefill = {}
      res.questions.forEach(q => {
        if (q.type === 'coding') {
          const lang = q.languages?.[0] || 'python'
          const starter = q.starter?.[lang] ?? q.starter_code
          if (starter) prefill[q.id] = JSON.stringify({ language: lang, code: starter })
        }
      })
      setAnswers(prefill)
      autoSubmittedRef.current = false
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
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer: String(answer ?? '') })),
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
              <input className="in" value={skillName} maxLength={50} onChange={e => setSkillName(e.target.value)} placeholder="e.g. Python, Java, DSA, Web Development" />
              <span className="muted" style={{ fontSize: 13 }}>Any course works — you can have up to 4 courses in total.</span>
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
                  <span className="muted" style={{ fontSize: 13 }}>Score 60%+ to become a tutor</span>
                </button>
                <button type="button" onClick={() => setRole('learning')} aria-pressed={role === 'learning'} className={`choice${role === 'learning' ? ' on' : ''}`}>
                  <span style={{ fontSize: 22 }}>📚</span><strong>I’m learning it</strong>
                  <span className="muted" style={{ fontSize: 13 }}>Find my level — or take the final challenge after 5 sessions</span>
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

              {!isCode && (() => {
                const { prompt, code } = splitQuestion(currentQuestion.question)
                return (
                <>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{prompt}</h2>
                  {code && (
                    <pre className="mono" style={{ padding: '18px 20px', border: '2px solid #29251F', borderRadius: 12, background: '#29251F', color: '#F8F3E9', fontSize: 15, lineHeight: 1.6, overflowX: 'auto' }}>
                      {code}
                    </pre>
                  )}
                  <div role="radiogroup" aria-label="Answer options" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(currentQuestion.options || []).map((opt, i) => {
                      // Answers are sent as the option TEXT — the server compares text (sending
                      // the index made every submission fail with a 422).
                      const selected = answers[currentQuestion.id] === opt
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAnswer(currentQuestion.id, opt)}
                          className={`opt${selected ? ' on' : ''}`}
                        >
                          <span className="key">{String.fromCharCode(65 + i)}</span>{opt}
                        </button>
                      )
                    })}
                  </div>
                </>
                )
              })()}

              {isCode && (
                <>
                  {currentQuestion.title && <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{currentQuestion.title}</h3>}
                  <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55 }}>{currentQuestion.question}</p>
                  <div style={{ padding: '14px 16px', border: '2px solid #29251F', borderRadius: 12, background: '#F8F3E9', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    {currentQuestion.function_name && (
                      <span><strong>Function name:</strong> <code className="mono">{currentQuestion.function_name}</code></span>
                    )}
                    {formatExample(currentQuestion) && (
                      <span><strong>Example:</strong> <code className="mono">{formatExample(currentQuestion)}</code></span>
                    )}
                    {currentQuestion.kind === 'sql' && currentQuestion.schema && (
                      <div><strong>Tables:</strong><pre className="mono" style={{ background: '#29251F', color: '#F8F3E9', borderRadius: 8, padding: 10, fontSize: 12, whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{currentQuestion.schema}</pre></div>
                    )}
                    {(currentQuestion.examples || []).map((ex, i) => (
                      <div key={i} className="mono" style={{ fontSize: 13 }}>
                        <strong style={{ fontFamily: 'Inter, sans-serif' }}>Example {i + 1}</strong>
                        {currentQuestion.kind === 'sql' ? (
                          <>
                            <div style={{ whiteSpace: 'pre-wrap' }}>Data: {ex.input}</div>
                            <div style={{ background: '#29251F', borderRadius: 8, padding: 8, marginTop: 4 }}><SqlTable results={[ex.output]} /></div>
                          </>
                        ) : (
                          <>
                            <div>Input: {ex.input}</div>
                            <div>Output: {JSON.stringify(ex.output)}</div>
                          </>
                        )}
                      </div>
                    ))}
                    <span className="muted" style={{ fontSize: 13 }}>
                      {currentQuestion.test_count
                        ? `Checked against ${currentQuestion.test_count} test cases. Partial credit is given for passing some but not all.`
                        : 'Checked against hidden test cases. Partial credit is given for passing some but not all.'}
                    </span>
                  </div>
                  <ArenaCodeEditor
                    key={currentQuestion.id}
                    q={currentQuestion}
                    value={answers[currentQuestion.id]}
                    onChange={v => setAnswer(currentQuestion.id, v)}
                    attemptId={attemptId}
                    onViolation={recordViolation}
                    draftsRef={codeDraftsRef}
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
                <span className="mono" style={{ fontSize: 40, fontWeight: 700 }}><CountUp to={Math.round(result.score)} /><span style={{ fontSize: 20 }}>%</span></span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {result.badge && <span className="pill" style={{ background: '#FBEFC4', height: 36, fontSize: 14 }}>🥇 {result.badge} badge</span>}
                {result.level && <span className="pill" style={{ height: 36, fontSize: 14 }}>{result.level}</span>}
                {result.role && <span className="pill" style={{ height: 36, fontSize: 14, background: result.role === 'teaching' ? '#D6F3EA' : '#E6DDF6' }}>{result.role === 'teaching' ? '🎓 Tutor' : '📚 Learner'}</span>}
              </div>
              {result.outcome_message && (
                <div style={{ padding: '12px 14px', border: '2px solid #29251F', borderRadius: 12, background: result.course_completed ? '#D6F3EA' : '#FBEFC4', fontWeight: 800, fontSize: 15, lineHeight: 1.45 }}>
                  {result.outcome_message}
                </div>
              )}
              <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>
                Your score, level and badge are now on your profile. Peers searching for {skillName} can see your verified badge.
              </p>
              {result.counted !== undefined && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '2px solid #29251F',
                  background: result.counted ? '#D6F3EA' : '#FBEFC4',
                  boxShadow: '0 3px 0 #29251F',
                  fontWeight: 800,
                  fontSize: 13,
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span>{result.counted ? '📅' : 'ℹ️'}</span>
                  <span>{result.counted ? 'This is your counted attempt for this week' : "This updates your level but isn't a new counted week"}</span>
                </div>
              )}
            </div>
          </div>

          <ArenaResultInsights result={result} skillName={skillName} />

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
