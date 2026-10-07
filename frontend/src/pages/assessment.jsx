import { useState, useEffect, useRef } from 'react'
import BackButton from "../components/BackButton";
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/skillbadge'
import { Compass, Swords, Target, Route, ArrowRight, ShieldCheck, Play, Maximize, AlertTriangle, ChevronRight, ChevronLeft, Clock, Code2 } from 'lucide-react'

const STEPS = { PICK: 'pick', QUIZ: 'quiz', RESULT: 'result' }

export default function Assessment() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(STEPS.PICK)
  const [skillName, setSkillName] = useState('')
  const [role, setRole] = useState('teaching')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Security / Anti-cheat
  const [violations, setViolations] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showWarning, setShowWarning] = useState(null)
  const lastViolation = useRef(0)

  // Timer
  const DEFAULT_TIME = 20 * 60; // 20 minutes
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);

  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request blocked:", err);
    }
  };

  useEffect(() => {
    if (step === STEPS.QUIZ) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };

      const recordViolation = (msg) => {
        const now = Date.now();
        // Debounce violations by 2 seconds to avoid double counting
        if (now - lastViolation.current > 2000) {
          lastViolation.current = now;
          setViolations(v => v + 1);
          setShowWarning(msg);
        }
      };

      const handleBlur = () => {
        recordViolation("You left the Skill Arena window. This violation has been recorded locally.");
      };
      
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          setIsFullscreen(false);
          recordViolation("Please return to Skill Arena fullscreen mode. This violation has been recorded locally.");
        } else {
          setIsFullscreen(true);
        }
      };

      window.addEventListener('blur', handleBlur);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [step]);

  useEffect(() => {
    let timer;
    if (step === STEPS.QUIZ && !loading) {
      if (timeLeft > 0) {
        timer = setInterval(() => {
          setTimeLeft(t => t - 1);
        }, 1000);
      } else {
        submitQuiz();
      }
    }
    return () => clearInterval(timer);
  }, [step, timeLeft, loading]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  async function executeStartQuiz(skillToStart) {
    if (!skillToStart.trim()) return
    setLoading(true)
    setError('')
    try {
      const qs = await api.assessmentQuestions(skillToStart.trim())
      setQuestions(qs)
      setAnswers({})
      setViolations(0)
      setTimeLeft(DEFAULT_TIME)
      setCurrentQuestionIndex(0)
      setStep(STEPS.QUIZ)
      // Attempt to enter fullscreen immediately
      enterFullscreen()
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

  useEffect(() => {
    const s = searchParams.get('skill')
    const r = searchParams.get('role')
    const auto = searchParams.get('autoStart') === 'true'
    
    if (s) setSkillName(s)
    if (r) setRole(r)
    
    if (s && auto) {
       executeStartQuiz(s)
    }
  }, [searchParams])

  async function submitQuiz() {
    if (loading) return;
    setLoading(true)
    setError('')
    try {
      const payload = {
        skill_name: skillName.trim(),
        role,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }))
      }
      const res = await api.submitAssessment(payload)
      setResult(res)
      setStep(STEPS.RESULT)
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const answeredCount = Object.keys(answers).length
  const totalCount = questions.length
  const progress = totalCount > 0 ? Math.round(((currentQuestionIndex + 1) / totalCount) * 100) : 0

  const handleNext = () => {
    if (currentQuestionIndex < totalCount - 1) {
      setCurrentQuestionIndex(i => i + 1)
    }
  }

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1)
    }
  }

  const currentQuestion = questions[currentQuestionIndex];
  const qType = currentQuestion ? (currentQuestion.type || 'mcq').toLowerCase() : 'mcq';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      {/* ✨ Step: Pick skill ✨ */}
      {step === STEPS.PICK && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20">
                <Swords className="w-4 h-4" />
             </div>
             <p className="text-[10px] font-bold text-brand uppercase tracking-wider">Skill Arena</p>
          </div>
          <h1 className="font-display text-4xl mb-2 text-ink">Enter the Skill Arena</h1>
          <p className="text-clay text-sm mb-8">
            Prove your mastery. You will enter a focused, fullscreen environment. 
          </p>

          <form onSubmit={startQuiz} className="space-y-6">
            <div>
              <label className="field-label" htmlFor="skill-name">Skill name</label>
              <input
                id="skill-name"
                className="input"
                placeholder="e.g. Python, JavaScript, UI Design"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <p className="field-label mb-3">Arena Goal</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RoleOption
                  label="I want to teach it"
                  sub="Get a verified teaching badge"
                  value="teaching"
                  role={role}
                  setRole={setRole}
                  icon="🎓"
                />
                <RoleOption
                  label="I'm learning it"
                  sub="See where I stand as a learner"
                  value="learning"
                  role={role}
                  setRole={setRole}
                  icon="📚"
                />
              </div>
            </div>

            {error && <p className="alert-error">{error}</p>}

            <button disabled={loading || !skillName.trim()} className="btn-primary w-full py-3 flex justify-center items-center gap-2 text-sm">
              {loading ? 'Initializing Arena…' : (
                 <>Enter Arena <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Step: Quiz ── */}
      {step === STEPS.QUIZ && questions.length > 0 && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div 
              className="animate-slide-up"
              onCopy={e => e.preventDefault()}
          onCut={e => e.preventDefault()}
          onPaste={e => e.preventDefault()}
          onContextMenu={e => e.preventDefault()}
          style={{ userSelect: 'none' }}
        >
          {showWarning && (
            <div className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4" style={{ userSelect: 'auto' }}>
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-line">
                <div className="flex items-center gap-3 text-red-600 mb-4">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Security Violation</h3>
                </div>
                <p className="text-sm text-ink/70 mb-6 font-medium">{showWarning}</p>
                <button onClick={() => setShowWarning(null)} className="btn-primary w-full py-2.5 justify-center">
                  Acknowledge and Continue
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Skill Arena: {skillName}
              </p>
              <h1 className="font-display text-2xl text-ink">Question {currentQuestionIndex + 1} of {totalCount}</h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 text-sm font-mono px-3 py-1 rounded-full ${timeLeft < 300 ? 'bg-red-50 text-red-600 font-bold' : 'bg-ink/5 text-ink/70'}`}>
                  <Clock className="w-4 h-4" />
                  {formatTime(timeLeft)}
                </div>
                {!isFullscreen && (
                  <button onClick={enterFullscreen} className="text-xs text-brand flex items-center gap-1 hover:underline">
                    <Maximize className="w-3.5 h-3.5" /> Enter Fullscreen
                  </button>
                )}
                {violations > 0 && (
                  <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" /> {violations} Violations
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="w-32 h-1.5 bg-line/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-500 ease-out animate-progress"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="card p-6 shadow-sm border-line/50">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-mono text-ink/40 bg-ink/5 px-2 py-0.5 rounded-full">
                  Topic
                </span>
                <span className="text-sm font-medium text-ink/70">{questions[currentQuestionIndex].topic}</span>
              </div>
              <p className="font-medium text-lg mb-6 whitespace-pre-wrap leading-relaxed text-ink">
                {questions[currentQuestionIndex].question}
              </p>
              
              {(qType === 'mcq' || qType === 'output') && (
                <div className="space-y-3">
                  {questions[currentQuestionIndex].options?.map((opt) => {
                    const qId = questions[currentQuestionIndex].id;
                    const isSelected = answers[qId] === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-start gap-3 text-sm cursor-pointer px-4 py-3.5 rounded-xl border-2 transition-all duration-150
                          ${isSelected
                            ? 'border-brand bg-brand/5 text-brand shadow-sm'
                            : 'border-line hover:border-ink/20 hover:bg-paper'
                          }`}
                      >
                        <input
                          type="radio"
                          name={qId}
                          className="accent-brand mt-0.5"
                          checked={isSelected}
                          onChange={() => setAnswers((a) => ({ ...a, [qId]: opt }))}
                        />
                        <span className={isSelected ? 'font-medium' : ''}>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {qType === 'coding' && (
                <div className="p-8 border-2 border-dashed border-brand/20 bg-brand/5 rounded-xl text-center">
                  <Code2 className="w-10 h-10 text-brand/40 mx-auto mb-3" />
                  <p className="text-sm font-bold text-brand mb-1">Course Compiler Integration Pending</p>
                  <p className="text-xs text-brand/70 max-w-xs mx-auto">This practical coding challenge will be fully interactive in the next phase of the Skill Arena.</p>
                </div>
              )}

              {qType === 'problem_solving' && (
                <div className="space-y-3">
                  <textarea 
                    className="input min-h-[150px] resize-y w-full" 
                    placeholder="Describe your solution approach..."
                    value={answers[questions[currentQuestionIndex].id] || ''}
                    onChange={(e) => setAnswers(a => ({...a, [questions[currentQuestionIndex].id]: e.target.value}))}
                    style={{ userSelect: 'text' }}
                  />
                </div>
              )}
            </div>
          </div>

          {error && <p className="alert-error mt-4">{error}</p>}

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              className="btn-secondary px-4 py-2 flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            
            {currentQuestionIndex < totalCount - 1 ? (
              <button
                onClick={handleNext}
                className="btn-primary px-6 py-2 flex items-center gap-1 shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={loading || answeredCount < totalCount}
                className="btn-primary px-6 py-2 flex items-center gap-2 shadow-sm"
              >
                {loading
                  ? 'Analyzing...'
                  : answeredCount < totalCount
                  ? `Answer all questions`
                  : 'Submit Arena'}
              </button>
            )}
          </div>
          
          {currentQuestionIndex === totalCount - 1 && answeredCount < totalCount && (
            <p className="text-center text-xs text-clay mt-4">
              You have answered {answeredCount} out of {totalCount} questions.
            </p>
          )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step: Result ── */}
      {step === STEPS.RESULT && result && (
        <div className="animate-slide-up max-w-lg mx-auto">
          <div className="flex justify-center mb-4">
             <div className="w-12 h-12 bg-gold/10 text-gold rounded-full flex items-center justify-center border border-gold/20 shadow-sm relative">
                <div className="absolute inset-0 border border-gold/30 rounded-full animate-ping opacity-20" />
                <ShieldCheck className="w-6 h-6" />
             </div>
          </div>
          
          <div className="text-center mb-8">
             <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">Arena Complete</p>
             <h1 className="font-display text-4xl text-ink mb-1">{skillName}</h1>
             <p className="text-clay text-sm">Your assessment is verified.</p>
             {violations > 0 && (
               <p className="text-xs text-red-600 font-bold mt-2">
                 Note: {violations} security violation(s) were recorded during this session.
               </p>
             )}
          </div>

          {/* Score hero */}
          <div className="bg-surface border border-line rounded-2xl p-6 mb-6 text-center shadow-sm relative overflow-hidden">
             <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold/50" />
             <p className="font-display text-6xl text-ink mb-3">{result.score}<span className="text-2xl text-clay">%</span></p>
             <div className="flex items-center justify-center gap-3 mb-1">
               <SkillBadge badge={result.badge} />
               <span className="font-semibold text-sm text-ink">{result.level}</span>
             </div>
             {result.badge && (
               <p className="text-xs font-bold text-brand bg-brand/10 inline-block px-3 py-1 rounded-full mt-3">+50 XP Earned</p>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Next Move (Weak Topics) */}
            <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Next Move
              </p>
              {result.weak_topics.length > 0 ? (
                <div>
                   <p className="text-sm font-semibold text-ink mb-2">Focus on {result.weak_topics[0]}</p>
                   <p className="text-xs text-clay">Master this to level up your overall {skillName} skill.</p>
                </div>
              ) : (
                <div>
                   <p className="text-sm font-semibold text-ink mb-2">Help Others</p>
                   <p className="text-xs text-clay">You have high mastery. Find someone to tutor.</p>
                </div>
              )}
            </div>

            {/* Study Plan */}
            <div className="bg-surface border border-line rounded-xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-clay uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" /> Path Ahead
              </p>
              <ul className="space-y-1.5">
                {result.study_plan.slice(0, 3).map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink/70">
                    <span className="text-brand/50 font-bold mt-0.5">•</span>
                    <span className="line-clamp-2">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link 
              to={result.weak_topics.length > 0 ? `/dashboard?weakTopic=${encodeURIComponent(result.weak_topics[0])}` : `/dashboard`} 
              className="btn-primary w-full justify-center py-3.5 font-semibold text-sm gap-2"
            >
              Continue your Skill Journey <Play className="w-4 h-4 fill-current" />
            </Link>
            <Link to="/marketplace" className="text-center text-xs font-semibold text-brand hover:underline py-2">
              or find a partner in the Marketplace
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleOption({ label, sub, value, role, setRole, icon }) {
  const active = role === value
  return (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`text-left px-4 py-3 rounded-xl border-2 transition-all duration-150
        ${active
          ? 'border-brand bg-brand/5'
          : 'border-line bg-white hover:border-ink/20'
        }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className={`text-sm font-medium ${active ? 'text-brand' : 'text-ink'}`}>{label}</span>
      </div>
      <p className="text-xs text-ink/40">{sub}</p>
    </button>
  )
}
