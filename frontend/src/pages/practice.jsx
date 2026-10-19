import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import './practice.css'

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

/* Practice: LeetCode-style problems for each course.
   Pick a course, filter by difficulty, open a problem, solve it in the editor.
   "Create a new problem" asks the AI for a fresh one (checked before it's saved). */
export default function Practice() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [courses, setCourses] = useState([])
  const [loaded, setLoaded] = useState({ key: null, list: [] })   // problems for one course + difficulty
  const [error, setError] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [search, setSearch] = useState('')
  const [genDifficulty, setGenDifficulty] = useState('Easy')
  const [genTopic, setGenTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const course = params.get('course') || ''

  useEffect(() => {
    api.practiceCourses().then(list => {
      setCourses(list)
      if (!params.get('course') && list.length) {
        const pick = list.find(c => c.mine && c.problems) || list[0]
        setParams({ course: pick.course }, { replace: true })
      }
    }).catch(err => setError(err.message || 'Could not load courses'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const listKey = `${course}|${difficulty}`
  useEffect(() => {
    if (!course) return
    let alive = true
    api.practiceProblems({ course, difficulty }).then(list => {
      if (alive) { setLoaded({ key: `${course}|${difficulty}`, list }); setError('') }
    }).catch(err => {
      if (alive) { setLoaded({ key: `${course}|${difficulty}`, list: [] }); setError(err.message || 'Could not load problems') }
    })
    return () => { alive = false }
  }, [course, difficulty])
  const loading = loaded.key !== listKey
  const problems = loaded.list

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return problems
    return problems.filter(p => p.title.toLowerCase().includes(q) || (p.topics || []).some(t => t.toLowerCase().includes(q)))
  }, [problems, search])

  const current = courses.find(c => c.course === course)

  const generate = async () => {
    setGenerating(true); setGenError('')
    try {
      const res = await api.practiceGenerate(course, genDifficulty, genTopic.trim())
      navigate(`/practice/${res.slug}`)
    } catch (err) {
      setGenError(err.message || 'The AI could not write a problem right now.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="sv-prac">
      <div className="wrap">
        <div className="head">
          <div>
            <div className="eb">PRACTICE</div>
            <h1>Solve coding problems</h1>
            <p className="muted" style={{ margin: 0 }}>Write code, run it on the examples, then submit it against hidden tests. First solve earns points.</p>
          </div>
          {current && (
            <div className="pill" style={{ height: 34, fontSize: 13 }}>
              ✅ {current.solved} / {current.problems} solved in {current.course}
            </div>
          )}
        </div>

        <div className="tabs" role="tablist" aria-label="Courses">
          {courses.map(c => (
            <button key={c.course} type="button" role="tab" className="tab" aria-selected={c.course === course}
              onClick={() => setParams({ course: c.course })}>
              {c.course}<span className="cnt">{c.problems}</span>
            </button>
          ))}
        </div>

        <div className="filters">
          <input className="field" placeholder="Search problems or topics" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search problems" />
          <select className="field" value={difficulty} onChange={e => setDifficulty(e.target.value)} aria-label="Difficulty">
            <option value="">All levels</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {error && <div className="card" style={{ padding: 14, marginBottom: 12, background: '#FFD9D0' }}>{error}</div>}

        <div className="card plist">
          {loading ? (
            <div className="empty muted">Loading problems…</div>
          ) : shown.length === 0 ? (
            <div className="empty muted">No problems here yet. Create one with the AI below.</div>
          ) : shown.map(p => (
            <Link key={p.slug} to={`/practice/${p.slug}`} className="prow">
              <span className="stat" title={p.status === 'solved' ? 'Solved' : p.status === 'attempted' ? 'Attempted' : 'Not tried'}>
                {p.status === 'solved' ? '✅' : p.status === 'attempted' ? '🟡' : '⚪'}
              </span>
              <span>
                <div className="ptitle">{p.title}</div>
                <div className="ptopics">{(p.topics || []).join(' · ')}{p.source === 'ai' ? ' · ✨ AI' : ''}</div>
              </span>
              <span className="pill">{p.kind === 'sql' ? 'SQL' : 'Code'}</span>
              <span className={`pill d-${p.difficulty}`}>{p.difficulty}</span>
            </Link>
          ))}
        </div>

        {course && (
          <div className="card gen">
            <strong>✨ Create a new {course} problem</strong>
            <select className="field" value={genDifficulty} onChange={e => setGenDifficulty(e.target.value)} aria-label="New problem difficulty">
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="field" style={{ flex: 1, minWidth: 160 }} maxLength={60} placeholder="Topic (optional), e.g. recursion" value={genTopic} onChange={e => setGenTopic(e.target.value)} aria-label="Topic" />
            <button type="button" className="btn btn-p" onClick={generate} disabled={generating}>
              {generating ? 'Writing & checking…' : 'Create problem'}
            </button>
            {genError && <div style={{ width: '100%', color: '#B3261E', fontSize: 13 }}>{genError}</div>}
            <div className="muted" style={{ width: '100%', fontSize: 12 }}>The AI writes the problem and a solution; SkillVerse runs the solution on every test before saving it. Up to 5 a day.</div>
          </div>
        )}
      </div>
    </div>
  )
}
