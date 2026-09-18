import { useState } from 'react'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/skillbadge'
import { Compass, Swords, Target, Route, ArrowRight, ShieldCheck, Play } from 'lucide-react'

const STEPS = { PICK: 'pick', QUIZ: 'quiz', RESULT: 'result' }

export default function Assessment() {
  const [step, setStep] = useState(STEPS.PICK)
  const [skillName, setSkillName] = useState('')
  const [role, setRole] = useState('teaching')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function startQuiz(e) {
    e.preventDefault()
    if (!skillName.trim()) return
    setLoading(true)
    setError('')
    try {
      const qs = await api.assessmentQuestions(skillName.trim())
      setQuestions(qs)
      setAnswers({})
      setStep(STEPS.QUIZ)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitQuiz() {
    setLoading(true)
    setError('')
    try {
      const payload = {
        skill_name: skillName.trim(),
        role,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
      }
      const res = await api.submitAssessment(payload)
      setResult(res)
      setStep(STEPS.RESULT)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const answeredCount = Object.keys(answers).length
  const totalCount = questions.length
  const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      {/* ✨ Step: Pick skill ✨ */}
      {step === STEPS.PICK && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 border border-brand/20">
                <Compass className="w-4 h-4" />
             </div>
             <p className="text-[10px] font-bold text-brand uppercase tracking-wider">Skill Journey • Start Node</p>
          </div>
          <h1 className="font-display text-4xl mb-2 text-ink">Start your Skill Challenge</h1>
          <p className="text-clay text-sm mb-8">
            Discover where you stand. Python and JavaScript have full challenges. Other skills use placeholders.
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
              <p className="field-label mb-3">Assessment goal</p>
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
              {loading ? 'Initializing challenge…' : (
                 <>Enter Challenge <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Step: Quiz ── */}
      {step === STEPS.QUIZ && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Current Challenge
              </p>
              <h1 className="font-display text-3xl text-ink">{skillName}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-clay font-bold tracking-wide mb-1.5">{answeredCount}/{totalCount} ANSWERED</p>
              <div className="w-32 h-1.5 bg-line/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500 ease-out animate-progress"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={`card p-5 transition-all duration-150 ${answers[q.id] ? 'border-moss/30' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-ink/30 bg-ink/5 px-2 py-0.5 rounded-full">
                    Q{i + 1}
                  </span>
                  <span className="text-xs text-ink/40">{q.topic}</span>
                  {answers[q.id] && (
                    <span className="ml-auto text-xs text-brand">✓ answered</span>
                  )}
                </div>
                <p className="font-medium text-sm mb-4 whitespace-pre-wrap leading-relaxed">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 text-sm cursor-pointer px-3 py-2.5 rounded-lg border transition-all duration-100
                        ${answers[q.id] === opt
                          ? 'border-brand bg-brand/5 text-brand'
                          : 'border-transparent hover:border-line hover:bg-paper'
                        }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        className="accent-brand"
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="alert-error mt-4">{error}</p>}

          <button
            onClick={submitQuiz}
            disabled={loading || answeredCount < totalCount}
            className="btn-primary w-full mt-8 py-3.5 justify-center font-semibold text-sm shadow-sm"
          >
            {loading
              ? 'Analyzing performance…'
              : answeredCount < totalCount
              ? `Answer all ${totalCount} challenges to submit`
              : 'Complete Challenge'}
          </button>
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
             <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-2">Discovery Complete</p>
             <h1 className="font-display text-4xl text-ink mb-1">{skillName}</h1>
             <p className="text-clay text-sm">Your initial assessment is verified.</p>
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
