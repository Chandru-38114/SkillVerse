import { useEffect, useState } from 'react'
import { api } from '../api'
import SkillBadge from '../components/SkillBadge'

export default function Marketplace() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState({}) // user_id+skill -> true
  const [requestMsg, setRequestMsg] = useState({}) // key -> draft message

  async function runSearch(skill) {
    setLoading(true)
    setError('')
    try {
      const data = await api.searchTeachers(skill)
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runSearch('')
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    runSearch(query.trim())
  }

  async function sendRequest(teacher) {
    const key = `${teacher.user_id}-${teacher.skill_name}`
    try {
      await api.sendRequest({
        to_user_id: teacher.user_id,
        skill_name: teacher.skill_name,
        message: requestMsg[key] || `Hi ${teacher.name}, I'd love to learn ${teacher.skill_name} from you.`,
      })
      setSentTo((s) => ({ ...s, [key]: true }))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <p className="label-eyebrow mb-1">Marketplace</p>
      <h1 className="font-display text-3xl mb-8">Find someone to learn from</h1>

      <form onSubmit={handleSearchSubmit} className="flex gap-3 mb-8">
        <input
          className="input"
          placeholder="Search by skill, e.g. Python"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary whitespace-nowrap">Search</button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : results.length === 0 ? (
        <div className="card p-8 text-center text-ink/60">
          No verified teachers found yet for that skill. Badges are only earned by
          scoring 40%+ on an assessment with role set to "teaching".
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {results.map((t) => {
            const key = `${t.user_id}-${t.skill_name}`
            const alreadySent = sentTo[key]
            return (
              <div key={key} className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display text-lg">{t.name}</p>
                    <p className="text-xs text-ink/50">{t.college || 'Independent learner'}</p>
                  </div>
                  <SkillBadge badge={t.badge} />
                </div>
                <p className="text-sm mb-3">
                  Teaches <span className="font-medium">{t.skill_name}</span>
                  <span className="text-ink/40"> · {t.level} · {t.score}%</span>
                </p>

                {alreadySent ? (
                  <p className="text-sm text-moss font-medium">Request sent ✓</p>
                ) : (
                  <div className="space-y-2">
                    <input
                      className="input text-sm"
                      placeholder={`Hi ${t.name}, I'd love to learn ${t.skill_name} from you.`}
                      value={requestMsg[key] || ''}
                      onChange={(e) => setRequestMsg((m) => ({ ...m, [key]: e.target.value }))}
                    />
                    <button onClick={() => sendRequest(t)} className="btn-secondary text-sm py-1.5 w-full">
                      Send connection request
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}