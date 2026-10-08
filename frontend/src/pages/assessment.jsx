import { useState, useEffect, useRef } from 'react'
import BackButton from "../components/BackButton";
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/skillbadge'
import { Compass, Swords, Target, Route, ArrowRight, ShieldCheck, Play, Maximize, AlertTriangle, ChevronRight, ChevronLeft, Clock, Code2, ShieldAlert } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = { PICK: 'pick', QUIZ: 'quiz', RESULT: 'result', TERMINATED: 'terminated' }
const MAX_VIOLATIONS = 3;

function LocalCompiler({ code, onChange, language }) {
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    setError('');
    setOutput('');
    try {
      const res = await api.runArenaCode(code);
      if (res.error) setError(res.error);
      setOutput(res.output || '');
    } catch (err) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      onChange(newCode);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 4;
      }, 0);
    }
  };

  return (
    <div className="flex flex-col border border-line rounded-xl overflow-hidden shadow-sm bg-[#1e1e1e]">
       <div className="bg-[#2d2d2d] border-b border-[#404040] px-4 py-3 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <Code2 className="w-4 h-4 text-[#d4d4d4]" />
           <span className="text-xs font-bold text-[#d4d4d4] uppercase tracking-wider">
             {language === 'Python' || language.toLowerCase() === 'python' ? 'Python 3' : `${language} (Run supports Python 3)`}
           </span>
         </div>
         <button onClick={handleRun} disabled={isRunning || !code.trim()} className="bg-brand hover:bg-brand/90 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors disabled:opacity-50 flex items-center gap-1.5">
           <Play className="w-3 h-3 fill-current" />
           {isRunning ? 'Running...' : 'Run Code'}
         </button>
       </div>
       <textarea 
         value={code}
         onChange={e => onChange(e.target.value)}
         onKeyDown={handleKeyDown}
         className="w-full h-[300px] p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm resize-y focus:outline-none"
         spellCheck="false"
         placeholder="Write your code here..."
       />
       <div className="bg-[#1e1e1e] border-t border-[#404040] flex flex-col h-[180px]">
         <div className="bg-[#2d2d2d] px-4 py-2 border-b border-[#404040]">
           <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">Console Output</span>
         </div>
         <div className="p-4 flex-1 overflow-y-auto font-mono text-sm text-[#d4d4d4]">
           {isRunning && !error && !output && <span className="text-[#858585] italic">Executing...</span>}
           {error && <div className="text-red-400 whitespace-pre-wrap">{error}</div>}
           {output && <div className="whitespace-pre-wrap">{output}</div>}
           {!isRunning && !error && !output && <span className="text-[#858585] italic text-xs">Run your code to see output...</span>}
         </div>
       </div>
    </div>
  )
}

export default function Assessment() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(STEPS.PICK)
  const [skillName, setSkillName] = useState('')
  const [role, setRole] = useState('teaching')
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [answers, setAnswers] = useState({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Security / Anti-cheat
  const [violations, setViolations] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showWarning, setShowWarning] = useState(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
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

  const recordViolation = (msg) => {
    const now = Date.now();
    if (now - lastViolation.current > 2000) {
      lastViolation.current = now;
      setViolations(v => {
        const newV = v + 1;
        if (newV >= MAX_VIOLATIONS) {
          submitQuiz(true); // Terminate and auto-submit
          return newV;
        }
        setShowWarning(`Violation ${newV} of ${MAX_VIOLATIONS}\n\n${msg}`);
        return newV;
      });
    }
  };

  useEffect(() => {
    if (step === STEPS.QUIZ) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };

      const handleVisibilityBlur = () => {
        if (document.visibilityState === 'hidden' || !document.hasFocus()) {
          recordViolation("You left the Skill Arena window. Return immediately.");
        }
      };
      
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          setIsFullscreen(false);
          recordViolation("Please return to Skill Arena fullscreen mode.");
        } else {
          setIsFullscreen(true);
        }
      };

      window.addEventListener('blur', handleVisibilityBlur);
      document.addEventListener('visibilitychange', handleVisibilityBlur);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('blur', handleVisibilityBlur);
        document.removeEventListener('visibilitychange', handleVisibilityBlur);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [step]);

  const submitRef = useRef(submitQuiz);
  useEffect(() => {
    submitRef.current = submitQuiz;
  });

  useEffect(() => {
    let timer;
    if (step === STEPS.QUIZ && !loading) {
      timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer);
            setTimeout(() => submitRef.current(), 0);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, loading]);

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
      const res = await api.startAssessment(skillToStart.trim())
      setQuestions(res.questions)
      setAttemptId(res.attempt_id)
      setAnswers({})
      setViolations(0)
      setTimeLeft(DEFAULT_TIME)
      setCurrentQuestionIndex(0)
      setStep(STEPS.QUIZ)
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

  async function submitQuiz(isTermination = false) {
    if (loading) return;
    setLoading(true)
    setError('')
    setShowSubmitConfirm(false)
    try {
      const payload = {
        skill_name: skillName.trim(),
        role,
        attempt_id: attemptId,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }))
      }
      const res = await api.submitAssessment(payload)
      setResult(res)
      if (isTermination) {
        setStep(STEPS.TERMINATED)
      } else {
        setStep(STEPS.RESULT)
      }
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
              {loading ? 'Generating your questions…' : (
                 <>Enter Arena <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Step: Quiz ── */}
      {step === STEPS.QUIZ && questions.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-[#f8f9fc] flex flex-col overflow-hidden"
          onCopy={e => { if(!e.target.closest('textarea')) e.preventDefault() }}
          onCut={e => { if(!e.target.closest('textarea')) e.preventDefault() }}
          onPaste={e => { if(!e.target.closest('textarea')) e.preventDefault() }}
          onContextMenu={e => { if(!e.target.closest('textarea') && !e.target.closest('input')) e.preventDefault() }}
        >
          {showWarning && (
            <div className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ userSelect: 'auto' }}>
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-line animate-slide-up text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2 text-ink">Security Warning</h3>
                <p className="text-clay font-medium mb-6 whitespace-pre-wrap">{showWarning}</p>
                <button onClick={() => { setShowWarning(null); enterFullscreen(); }} className="btn-primary w-full py-3 justify-center text-lg shadow-md">
                  Acknowledge and Continue
                </button>
              </div>
            </div>
          )}

          {showSubmitConfirm && (
            <div className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-line animate-slide-up text-center">
                <h3 className="font-display font-bold text-2xl mb-3 text-ink">Submit Arena?</h3>
                <p className="text-clay mb-2 font-medium">
                  You answered {answeredCount} of {totalCount} questions.
                </p>
                {answeredCount < totalCount && (
                  <p className="text-red-500 font-bold mb-4 bg-red-50 py-2 rounded-lg border border-red-100">
                    {totalCount - answeredCount} {totalCount - answeredCount === 1 ? 'question' : 'questions'} remaining!
                  </p>
                )}
                <p className="text-xs text-clay mb-6">Once submitted, you cannot modify your answers.</p>
                <div className="flex gap-3">
                   <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary flex-1 py-3 justify-center font-bold">Cancel</button>
                   <button onClick={() => submitQuiz()} disabled={loading} className="btn-primary flex-1 py-3 justify-center font-bold shadow-md">Submit</button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="bg-white border-b border-line px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 shadow-sm z-10 gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-brand">
                <Swords className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Skill Arena</span>
              </div>
              <h1 className="text-lg font-display text-ink mt-0.5">{skillName}</h1>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-ink mb-1.5">Question {currentQuestionIndex + 1} of {totalCount}</span>
              <div className="w-48 h-1.5 bg-line/50 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {violations > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5" /> {violations} / {MAX_VIOLATIONS} Violations
                </div>
              )}
              <div className={`flex items-center gap-2 px-5 py-2 rounded-full border shadow-sm font-mono text-base font-bold transition-colors ${timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-ink border-line'}`}>
                <Clock className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
            <div className="max-w-4xl mx-auto w-full">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bg-white rounded-2xl p-6 md:p-10 border border-line shadow-sm mb-6">
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink/50 bg-ink/5 px-2.5 py-1 rounded-full">Topic: {currentQuestion.topic}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand/10 px-2.5 py-1 rounded-full">{qType.replace('_', ' ')}</span>
                    </div>
                    
                    <h2 className="text-xl font-medium text-ink leading-relaxed mb-8 whitespace-pre-wrap select-none">
                      {currentQuestion.question}
                    </h2>
                    
                    {(qType === 'mcq' || qType === 'output') ? (
                      <div className="space-y-3">
                        {currentQuestion.options?.map((opt) => {
                          const qId = currentQuestion.id;
                          const isSelected = answers[qId] === opt;
                          return (
                            <label
                              key={opt}
                              className={`flex items-start gap-3 text-sm cursor-pointer px-5 py-4 rounded-xl border-2 transition-all duration-150
                                ${isSelected ? 'border-brand bg-brand/5 text-brand shadow-sm' : 'border-line hover:border-ink/20 hover:bg-paper'}`}
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
                    ) : qType === 'problem_solving' ? (
                      <div className="space-y-4">
                        <textarea 
                          className="w-full min-h-[250px] p-5 bg-paper border border-line rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all resize-y text-ink placeholder:text-clay font-mono text-sm shadow-inner"
                          placeholder="Describe your solution approach or write code here..."
                          value={answers[currentQuestion.id] || ''}
                          onChange={e => setAnswers(a => ({...a, [currentQuestion.id]: e.target.value}))}
                        />
                      </div>
                    ) : qType === 'coding' ? (
                      <LocalCompiler 
                        code={answers[currentQuestion.id] || ''} 
                        onChange={code => setAnswers(a => ({...a, [currentQuestion.id]: code}))}
                        language={skillName} 
                      />
                    ) : null}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer Navigation */}
          <footer className="bg-white border-t border-line px-4 sm:px-6 py-4 shrink-0 z-10 relative">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
              <button 
                onClick={handlePrev} 
                disabled={currentQuestionIndex === 0}
                className="btn-secondary px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 font-bold"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 max-w-[200px] sm:max-w-sm hidden md:flex scrollbar-hide mask-edges">
                {questions.map((q, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentQuestionIndex(i)}
                    className={`w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-colors flex items-center justify-center ${
                      i === currentQuestionIndex ? 'bg-brand text-white border border-brand ring-2 ring-brand/30 shadow-sm' :
                      answers[q.id] ? 'bg-brand/10 text-brand border border-brand/20' : 
                      'bg-paper text-clay border border-line hover:bg-lift'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {currentQuestionIndex < totalCount - 1 ? (
                <button 
                  onClick={handleNext} 
                  className="btn-secondary px-6 py-2.5 flex items-center gap-2 bg-ink/5 hover:bg-ink/10 text-ink border-none font-bold"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={() => setShowSubmitConfirm(true)}
                  className="btn-primary px-8 py-2.5 flex items-center gap-2 shadow-md font-bold"
                >
                  Submit Arena <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </footer>
        </div>
      )}

      {/* ── Step: Terminated ── */}
      {step === STEPS.TERMINATED && (
        <div className="fixed inset-0 z-50 bg-[#f8f9fc] flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl border border-line text-center animate-slide-up">
              <div className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-600/20">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h1 className="font-display text-3xl mb-3 text-ink">Skill Arena Terminated</h1>
              <p className="text-clay mb-8 text-sm font-medium leading-relaxed">
                 Your Skill Arena was closed because the maximum number of security violations ({MAX_VIOLATIONS}) was reached.
                 Your attempt has been recorded and submitted.
              </p>
              <button onClick={() => setStep(STEPS.RESULT)} disabled={loading} className="btn-primary w-full py-3 justify-center shadow-md">
                 {loading ? 'Processing...' : 'View Result'}
              </button>
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
               <p className="text-xs text-red-600 font-bold mt-2 bg-red-50 inline-block px-3 py-1 rounded-full border border-red-100">
                 Note: {violations} security violation(s) were recorded.
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
