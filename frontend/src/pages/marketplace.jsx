import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import SkillBadge from '../components/SkillBadge'

export default function Marketplace() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // key: `${user_id}-${skill_name}` → { status, request_id }
  const [statusMap, setStatusMap] = useState({})
  const [requestMsg, setRequestMsg] = useState({})
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

  async function sendRequest(teacher) {
    const key = `${teacher.user_id}-${teacher.skill_name}`
    setError('')
    try {
      const created = await api.sendRequest({
        to_user_id: teacher.user_id,
        skill_name: teacher.skill_name,
        message: requestMsg[key] || `Hi ${teacher.name}, I'd love to learn ${teacher.skill_name} from you.`,
      })
      setStatusMap((m) => ({ ...m, [key]: { status: 'pending', request_id: created.id } }))
    } catch (err) {
      if (err.message.includes('already pending')) {
        setStatusMap((m) => ({ ...m, [key]: { status: 'pending', request_id: null } }))
      } else if (err.message.includes('already connected')) {
        setStatusMap((m) => ({ ...m, [key]: { status: 'accepted', request_id: null } }))
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
              const key = `${t.user_id}-${t.skill_name}`
              const rel = statusMap[key] || { status: 'none', request_id: null }
              return (
                <div key={key} className="card-hover p-6">
                  {/* Teacher header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-base">{t.name}</p>
                      <p className="text-xs text-ink/40 mt-0.5">{t.college || 'Independent learner'}</p>
                    </div>
                    <SkillBadge badge={t.badge} />
                  </div>

                  {/* Skill info */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-moss/8 text-moss border border-moss/15 px-2 py-0.5 rounded-full font-medium">
                      {t.skill_name}
                    </span>
                    <span className="text-xs text-ink/40">{t.level}</span>
                    <span className="text-xs text-ink/30">·</span>
                    <span className="text-xs text-ink/40 font-mono">{t.score}%</span>
                  </div>

                  {/* Rating */}
                  <RatingSummary data={ratingsMap[t.user_id]} />

                  <div className="border-t border-line/60 mt-4 pt-4">
                    <RequestControl
                      rel={rel}
                      teacher={t}
                      msgKey={key}
                      requestMsg={requestMsg}
                      setRequestMsg={setRequestMsg}
                      onSend={() => sendRequest(t)}
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
 * none / declined / completed → send form
 * pending                     → badge
 * accepted                    → connected + chat link
 */
function RequestControl({ rel, teacher, msgKey, requestMsg, setRequestMsg, onSend }) {
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

  return (
    <div className="space-y-2">
      <input
        className="input text-sm"
        placeholder={`Message ${teacher.name}…`}
        value={requestMsg[msgKey] || ''}
        onChange={(e) => setRequestMsg((m) => ({ ...m, [msgKey]: e.target.value }))}
      />
      <button onClick={onSend} className="btn-primary text-sm py-2 w-full">
        {(rel.status === 'declined' || rel.status === 'completed')
          ? 'Send request again'
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