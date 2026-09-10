import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/skillbadge'

// Default form state for a new request — one per teacher card
function defaultForm() {
  return {
    learner_current_level: '',
    learner_topics: '',
    learner_goals: '',
    learner_can_teach: '',
    learner_teach_proficiency: '',
    message: '',
  }
}

export default function Marketplace() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // key: `${user_id}-${skill_name}` → { status, request_id }
  const [statusMap, setStatusMap] = useState({})
  // key: `${user_id}-${skill_name}` → form object
  const [formMap, setFormMap] = useState({})
  // key: user_id → { average_rating, review_count }
  const [ratingsMap, setRatingsMap] = useState({})

  async function runSearch(skill) {
    setLoading(true)
    setError('')
    try {
      const data = await api.searchTeachers(skill)
      setResults(data)
      const [statuses, ratings] = await Promise.all([
        Promise.all(data.map((t) => api.getConnectionStatus(t.user_id, t.skill_name))),
        Promise.allSettled(data.map((t) => api.getUserReviews(t.user_id))),
      ])
      const map = {}
      const rMap = {}
      data.forEach((t, i) => {
        map[`${t.user_id}-${t.skill_name}`] = statuses[i]
        if (ratings[i].status === 'fulfilled') rMap[t.user_id] = ratings[i].value
      })
      setStatusMap(map)
      setRatingsMap(rMap)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runSearch('') }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    runSearch(query.trim())
  }

  function getForm(key) {
    return formMap[key] || defaultForm()
  }

  function updateForm(key, field, value) {
    setFormMap((m) => ({ ...m, [key]: { ...getForm(key), [field]: value } }))
  }

  async function sendRequest(teacher, targetSkill) {
    const key = `${teacher.user_id}`
    const form = getForm(key)
    setError('')
    try {
      const created = await api.sendRequest({
        to_user_id: teacher.user_id,
        skill_name: targetSkill,
        message: form.message || `Hi ${teacher.name}, I'd love to learn ${targetSkill} from you.`,
        learner_current_level: form.learner_current_level || null,
        learner_topics: form.learner_topics || null,
        learner_goals: form.learner_goals || null,
        learner_can_teach: form.learner_can_teach || null,
        learner_teach_proficiency: form.learner_teach_proficiency || null,
      })
      const relKey = `${teacher.user_id}-${targetSkill}`
      setStatusMap((m) => ({ ...m, [relKey]: { status: 'pending', request_id: created.id } }))
    } catch (err) {
      const relKey = `${teacher.user_id}-${targetSkill}`
      if (err.message.includes('already pending')) {
        setStatusMap((m) => ({ ...m, [relKey]: { status: 'pending', request_id: null } }))
      } else if (err.message.includes('already connected')) {
        setStatusMap((m) => ({ ...m, [relKey]: { status: 'accepted', request_id: null } }))
      } else {
        setError(err.message)
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <p className="label-eyebrow mb-1">Marketplace</p>
      <h1 className="font-display text-4xl mb-8">Find someone to learn from</h1>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30 text-sm">🔍</span>
          <input
            className="input pl-9"
            placeholder="Search by skill — Python, Design, Guitar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn-primary whitespace-nowrap">Search</button>
      </form>

      {error && <p className="alert-error mb-6">{error}</p>}

      {loading ? (
        <TeacherSkeleton />
      ) : results.length === 0 ? (
        <EmptyTeachers query={query} />
      ) : (
        <>
          <p className="text-sm text-ink/40 mb-4">{results.length} verified teacher{results.length !== 1 ? 's' : ''} found</p>
          <div className="grid md:grid-cols-2 gap-4">
            {results.map((t) => {
              const key = `${t.user_id}`
              // We'll manage the selected skill to request in the form state
              const form = getForm(key)
              
              // If they haven't selected a skill to request yet, default to the first teaching skill
              const targetSkill = form.target_skill || t.teaching_skills[0]?.skill_name
              const relKey = `${t.user_id}-${targetSkill}`
              const rel = statusMap[relKey] || { status: 'none', request_id: null }

              return (
                <div key={key} className="card-hover p-6">
                  {/* Teacher header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-base">{t.name}</p>
                      <p className="text-xs text-ink/40 mt-0.5">{t.college || 'Independent learner'}</p>
                    </div>
                  </div>

                  {/* Rating */}
                  <RatingSummary data={ratingsMap[t.user_id]} />

                  {/* Teaches */}
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold text-ink/40 uppercase tracking-wider mb-2">Teaches</p>
                    <div className="flex flex-wrap gap-2">
                      {t.teaching_skills.map(s => (
                        <div key={s.skill_name} className="flex items-center gap-2 bg-moss/5 border border-moss/10 px-2 py-1 rounded">
                          <span className="text-xs font-medium text-moss">{s.skill_name}</span>
                          <span className="text-[10px] text-ink/40">{s.level}</span>
                          <SkillBadge badge={s.badge} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Wants to Learn */}
                  {t.learning_skills.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold text-ink/40 uppercase tracking-wider mb-2">Wants to Learn</p>
                      <div className="flex flex-wrap gap-2">
                        {t.learning_skills.map(s => (
                          <span key={s.skill_name} className="text-xs bg-ink/5 text-ink/60 border border-line px-2 py-1 rounded">
                            {s.skill_name} <span className="text-[10px] text-ink/40 opacity-70 ml-1">{s.level}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-line/60 mt-4 pt-4">
                    <RequestControl
                      rel={rel}
                      teacher={t}
                      targetSkill={targetSkill}
                      form={form}
                      onFormChange={(field, value) => updateForm(key, field, value)}
                      onSend={() => sendRequest(t, targetSkill)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * none / declined / completed → rich send form
 * pending                     → pending badge
 * accepted                    → connected + chat link
 */
function RequestControl({ rel, teacher, targetSkill, form, onFormChange, onSend }) {
  if (rel.status === 'accepted') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-moss bg-moss/8 border border-moss/20 px-2.5 py-1 rounded-full">
          Connected ✓
        </span>
        {rel.request_id && (
          <Link to={`/chat/${rel.request_id}`} className="btn-secondary text-xs py-1.5 px-3">
            Open chat →
          </Link>
        )}
      </div>
    )
  }

  if (rel.status === 'pending') {
    return (
      <span className="text-xs font-medium text-gold bg-gold/10 border border-gold/20 px-2.5 py-1 rounded-full">
        Request pending…
      </span>
    )
  }

  const LEVELS = ['', 'Beginner', 'Intermediate', 'Advanced']

  return (
    <div className="space-y-4">
      {/* ── Section 1: I want to learn ─────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide">
            I want to learn
          </p>
          {teacher.teaching_skills.length > 1 ? (
            <select
              className="input text-xs py-1 px-2 min-h-0 bg-transparent border-none font-medium text-moss"
              value={targetSkill}
              onChange={(e) => onFormChange('target_skill', e.target.value)}
            >
              {teacher.teaching_skills.map(s => (
                <option key={s.skill_name} value={s.skill_name}>{s.skill_name}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-medium text-moss">{targetSkill}</span>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-ink/50 mb-1 block">My current level</label>
            <select
              className="input text-sm py-1.5"
              value={form.learner_current_level}
              onChange={(e) => onFormChange('learner_current_level', e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l || '— Select level —'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink/50 mb-1 block">Topics I want to improve</label>
            <input
              className="input text-sm"
              placeholder="e.g. Loops, Functions, Decorators"
              value={form.learner_topics}
              onChange={(e) => onFormChange('learner_topics', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-ink/50 mb-1 block">My learning goals</label>
            <input
              className="input text-sm"
              placeholder="e.g. Build REST APIs, pass my exams"
              value={form.learner_goals}
              onChange={(e) => onFormChange('learner_goals', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: I can teach ─────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide mb-2">
          In return, I can teach
        </p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-ink/50 mb-1 block">Skills I can teach</label>
            <input
              className="input text-sm"
              placeholder="e.g. React, Machine Learning, Spanish"
              value={form.learner_can_teach}
              onChange={(e) => onFormChange('learner_can_teach', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-ink/50 mb-1 block">My proficiency in those skills</label>
            <select
              className="input text-sm py-1.5"
              value={form.learner_teach_proficiency}
              onChange={(e) => onFormChange('learner_teach_proficiency', e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l || '— Select level —'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Optional message ───────────────────────────────────── */}
      <div>
        <label className="text-xs text-ink/50 mb-1 block">Personal message (optional)</label>
        <input
          className="input text-sm"
          placeholder={`Introduce yourself to ${teacher.name}…`}
          value={form.message}
          onChange={(e) => onFormChange('message', e.target.value)}
        />
      </div>

      <button onClick={onSend} className="btn-primary text-sm py-2 w-full">
        {(rel.status === 'declined' || rel.status === 'completed')
          ? 'Send request again →'
          : 'Send connection request →'}
      </button>
    </div>
  )
}


function RatingSummary({ data }) {
  if (!data || data.review_count === 0) return null
  const filled = Math.round(data.average_rating)
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="flex gap-0.5 text-sm leading-none">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={s <= filled ? 'text-gold' : 'text-ink/15'}>★</span>
        ))}
      </span>
      <span className="text-xs text-ink/40">
        {data.average_rating.toFixed(1)} · {data.review_count} review{data.review_count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function TeacherSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-6 space-y-3">
          <div className="flex justify-between">
            <div className="space-y-2">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-20 rounded" />
            </div>
            <div className="skeleton h-6 w-14 rounded-full" />
          </div>
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function EmptyTeachers({ query }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-4xl mb-4">🔍</p>
      <h2 className="font-display text-xl mb-2">No teachers found{query ? ` for "${query}"` : ''}</h2>
      <p className="text-sm text-ink/50 max-w-sm mx-auto">
        Verified teachers must score 40%+ on an assessment with role set to "teaching" to appear here.
      </p>
    </div>
  )
}
