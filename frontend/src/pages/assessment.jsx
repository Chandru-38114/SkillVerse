import { useState } from 'react'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/skillbadge'

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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* ✨ Step: Pick skill ✨ */}
      {step === STEPS.PICK && (
        <>
          <p className="label-eyebrow mb-2">Skill assessment</p>
          <h1 className="font-display text-4xl mb-2">What skill are you assessing?</h1>
          <p className="text-ink/50 text-sm mb-8">
            Python and JavaScript have a full question bank. Other skills use placeholder questions.
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

            <button disabled={loading || !skillName.trim()} className="btn-primary w-full py-3">
              {loading ? 'Loading questions…' : 'Start assessment →'}
            </button>
          </form>
        </>
      )}

      {/* ── Step: Quiz ── */}
      {step === STEPS.QUIZ && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="label-eyebrow">{skillName}</p>
              <h1 className="font-display text-3xl">Answer as best you can</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink/40 font-mono mb-1">{answeredCount}/{totalCount} answered</p>
              <div className="w-24 h-1.5 bg-ink/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-moss rounded-full transition-all duration-300"
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
                    <span className="ml-auto text-xs text-moss">✓ answered</span>
                  )}
                </div>
                <p className="font-medium text-sm mb-4 whitespace-pre-wrap leading-relaxed">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-3 text-sm cursor-pointer px-3 py-2.5 rounded-lg border transition-all duration-100
                        ${answers[q.id] === opt
                          ? 'border-moss bg-moss/5 text-moss'
                          : 'border-transparent hover:border-line hover:bg-paper'
                        }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        className="accent-moss"
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
            className="btn-primary w-full mt-6 py-3"
          >
            {loading
              ? 'Scoring your answers…'
              : answeredCount < totalCount
              ? `Answer all ${totalCount} questions to submit`
              : 'Submit assessment →'}
          </button>
        </>
      )}

      {/* ── Step: Result ── */}
      {step === STEPS.RESULT && result && (
        <>
          <p className="label-eyebrow mb-3">Assessment complete</p>

          {/* Score hero */}
          <div className="card p-8 mb-6 text-center bg-gradient-to-b from-white to-paper/60">
            <p className="font-display text-7xl mb-3">{result.score}%</p>
            <div className="flex items-center justify-center gap-3">
              <SkillBadge badge={result.badge} />
              <span className="text-sm text-ink/50">{result.level}</span>
            </div>
            {result.badge && (
              <p className="text-sm text-moss mt-3 font-medium">+50 points awarded 🎉</p>
            )}
          </div>

          {result.weak_topics.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="label-eyebrow mb-3">Topics to strengthen</p>
              <div className="flex flex-wrap gap-2">
                {result.weak_topics.map((t) => (
                  <span key={t} className="text-xs bg-clay/10 text-clay border border-clay/20 px-3 py-1 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5 mb-8">
            <p className="label-eyebrow mb-3">Your study plan</p>
            <ul className="space-y-2">
              {result.study_plan.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink/70">
                  <span className="text-moss mt-0.5">→</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link 
              to={result.weak_topics.length > 0 ? `/dashboard?weakTopic=${encodeURIComponent(result.weak_topics[0])}` : `/dashboard`} 
              className="btn-primary"
            >
              Back to Skill Journey
            </Link>
            <Link to="/marketplace" className="btn-secondary">Find teachers →</Link>
          </div>
        </>
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
          ? 'border-moss bg-moss/5'
          : 'border-line bg-white hover:border-ink/20'
        }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className={`text-sm font-medium ${active ? 'text-moss' : 'text-ink'}`}>{label}</span>
      </div>
      <p className="text-xs text-ink/40">{sub}</p>
    </button>
  )
}
