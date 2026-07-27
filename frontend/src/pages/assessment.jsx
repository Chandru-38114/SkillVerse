import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/SkillBadge'

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

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {step === STEPS.PICK && (
        <>
          <p className="label-eyebrow mb-1">Skill assessment</p>
          <h1 className="font-display text-3xl mb-8">What do you want to be assessed on?</h1>
          <form onSubmit={startQuiz} className="space-y-5">
            <label className="block">
              <span className="label-eyebrow block mb-1.5">Skill name</span>
              <input
                className="input"
                placeholder="e.g. Python, JavaScript, UI Design"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
              <span className="text-xs text-ink/40 mt-1 block">
                Python and JavaScript have a full hand-written question bank in this demo; any other
                skill name falls back to placeholder questions — swap in an LLM call to generate
                real ones (see backend/app/data/questions.py).
              </span>
            </label>
            <label className="block">
              <span className="label-eyebrow block mb-1.5">This assessment is to...</span>
              <div className="flex gap-3">
                <RoleOption label="Verify I can teach it" value="teaching" role={role} setRole={setRole} />
                <RoleOption label="See where I stand as a learner" value="learning" role={role} setRole={setRole} />
              </div>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="btn-primary w-full">
              {loading ? 'Loading questions…' : 'Start assessment'}
            </button>
          </form>
        </>
      )}

      {step === STEPS.QUIZ && (
        <>
          <p className="label-eyebrow mb-1">{skillName}</p>
          <h1 className="font-display text-3xl mb-8">Answer as best you can</h1>
          <div className="space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="card p-5">
                <p className="text-xs text-ink/40 font-mono mb-2">Q{i + 1} · {q.topic}</p>
                <p className="mb-3 whitespace-pre-wrap font-medium">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
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
          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
          <button
            onClick={submitQuiz}
            disabled={loading || Object.keys(answers).length < questions.length}
            className="btn-primary w-full mt-6"
          >
            {loading ? 'Scoring…' : 'Submit assessment'}
          </button>
        </>
      )}

      {step === STEPS.RESULT && result && (
        <>
          <p className="label-eyebrow mb-1">Result</p>
          <div className="flex items-center gap-4 mb-6">
            <h1 className="font-display text-4xl">{result.score}%</h1>
            <SkillBadge badge={result.badge} />
            <span className="text-sm text-ink/50">{result.level}</span>
          </div>

          {result.weak_topics.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="label-eyebrow mb-2">Weak topics</p>
              <div className="flex flex-wrap gap-2">
                {result.weak_topics.map((t) => (
                  <span key={t} className="text-xs bg-clay/10 text-clay px-2 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5 mb-8">
            <p className="label-eyebrow mb-2">Personalized study plan</p>
            <ul className="space-y-1 text-sm">
              {result.study_plan.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>

          <div className="flex gap-3">
            <Link to="/dashboard" className="btn-primary">Back to dashboard</Link>
            <Link to="/marketplace" className="btn-secondary">Find teachers</Link>
          </div>
        </>
      )}
    </div>
  )
}

function RoleOption({ label, value, role, setRole }) {
  const active = role === value
  return (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`text-sm px-3 py-2 rounded-sk border ${active ? 'border-moss bg-moss/5 text-moss' : 'border-line text-ink/60'}`}
    >
      {label}
    </button>
  )
}