import { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import './marketplace.css'

const AV_BG = ['#E6DDF6', '#FBEFC4', '#D6F3EA', '#FFE3CF']

function defaultForm() {
  return {
    target_skill: '',
    learner_current_level: '',
    learner_topics: '',
    learner_goals: '',
    learner_can_teach: '',
    learner_teach_proficiency: '',
    message: '',
  }
}

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQ)
  const [activeFilter, setActiveFilter] = useState('All') // 'All', 'I Want to Learn', 'I Can Teach'
  const [proficiency, setProficiency] = useState('All') // 'All', 'Intermediate', 'Advanced', 'Expert'

  const [results, setResults] = useState([])
  const [mySkills, setMySkills] = useState([])
  const [circleSuggestions, setCircleSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [proposingCycleId, setProposingCycleId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Demand request states
  const [demandLoading, setDemandLoading] = useState(false)
  const [demandSuccess, setDemandSuccess] = useState('')
  const [demandTeacher, setDemandTeacher] = useState(null)
  const [demandError, setDemandError] = useState('')
  const [demandMessage, setDemandMessage] = useState('')
  const [demandSubmitting, setDemandSubmitting] = useState(false)
  const [demandRequestSent, setDemandRequestSent] = useState(false)

  const [statusMap, setStatusMap] = useState({})
  const [formMap, setFormMap] = useState({})
  const [ratingsMap, setRatingsMap] = useState({})
  const [toast, setToast] = useState('')

  const user = getSessionUser()
  const toastTimer = useRef(null)

  useEffect(() => {
    const qFromUrl = searchParams.get('q') || ''
    setQuery(qFromUrl)
    runSearch(qFromUrl, activeFilter)
    api.mySkills().then(setMySkills).catch(() => {})
    fetchCircleSuggestions()
  }, [searchParams])

  async function fetchCircleSuggestions() {
    setLoadingSuggestions(true)
    try {
      const data = await api.getExchangeSuggestions()
      setCircleSuggestions(Array.isArray(data) ? data : [])
    } catch (_) {
      setCircleSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  async function handleProposeCircle(cycle, cycleIdx) {
    if (proposingCycleId !== null) return
    setProposingCycleId(cycleIdx)
    try {
      const legsPayload = cycle.legs.map(l => ({
        teacher_id: l.teacher_id,
        learner_id: l.learner_id,
        skill_id: l.skill_id
      }))
      await api.proposeExchangeCycle(legsPayload)
      showToast('Skill circle proposed successfully! Check Exchanges to track responses.')
      // Refresh suggestions
      fetchCircleSuggestions()
    } catch (err) {
      showToast(err.message || 'Failed to propose circle')
    } finally {
      setProposingCycleId(null)
    }
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function showToast(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 5000)
  }

  async function runSearch(skillQuery, roleFilter) {
    setLoading(true)
    setError('')
    setDemandSuccess('')
    setDemandTeacher(null)
    setDemandError('')
    setDemandMessage('')
    setDemandRequestSent(false)
    try {
      const data = await api.searchTeachers(skillQuery, roleFilter)
      setResults(data)

      const newStatusMap = {}
      const newRatingsMap = {}
      const newFormMap = {}

      data.forEach(t => {
        newRatingsMap[t.user_id] = {
          average_rating: t.average_rating,
          review_count: t.review_count
        }

        t.teaching_skills.forEach(s => {
          const statusObj = t.connection_statuses[s.skill_name]
          if (statusObj) newStatusMap[`${t.user_id}-${s.skill_name}`] = statusObj
        })
        t.learning_skills.forEach(s => {
          const statusObj = t.connection_statuses[s.skill_name]
          if (statusObj) newStatusMap[`${t.user_id}-${s.skill_name}`] = statusObj
        })

        let displaySkills = [];
        if (roleFilter === 'I Can Teach') {
          displaySkills = t.learning_skills;
        } else if (roleFilter === 'I Want to Learn') {
          displaySkills = t.teaching_skills;
        } else {
          const combined = new Map();
          t.teaching_skills.forEach(s => combined.set(s.skill_name, { ...s, intent: 'learn' }));
          t.learning_skills.forEach(s => {
            if (!combined.has(s.skill_name)) {
              combined.set(s.skill_name, { ...s, intent: 'teach' });
            }
          });
          displaySkills = Array.from(combined.values());
        }

        const initialSkill = displaySkills.length > 0 ? displaySkills[0].skill_name : '';
        newFormMap[t.user_id] = { ...defaultForm(), target_skill: initialSkill };
      })
      setStatusMap(newStatusMap)
      setRatingsMap(newRatingsMap)
      setFormMap(newFormMap)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    const trimmed = query.trim()
    const currentQ = searchParams.get('q') || ''
    if (trimmed !== currentQ) {
      setSearchParams(trimmed ? { q: trimmed } : {})
    } else {
      runSearch(trimmed, activeFilter)
    }
  }

  function handleFilterChange(filter) {
    setActiveFilter(filter)
    runSearch(query, filter)
  }

  function updateForm(key, field, value) {
    setFormMap(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  const [submitting, setSubmitting] = useState(false)

  async function sendRequest(teacher, skillName) {
    if (submitting) return;
    const form = formMap[teacher.user_id] || defaultForm()

    setSubmitting(true)
    try {
      await api.sendRequest({
        to_user_id: teacher.user_id,
        skill_name: skillName,
        message: form.message
      })

      setStatusMap(prev => ({ ...prev, [`${teacher.user_id}-${skillName}`]: { status: 'pending' } }))
      showToast(`Connection request sent to ${teacher.name}!`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCategoryClick = (category) => {
    setQuery(category)
    const currentQ = searchParams.get('q') || ''
    if (category !== currentQ) {
      setSearchParams({ q: category })
    } else {
      runSearch(category, activeFilter)
    }
  }

  async function handleDemandRequest() {
    const skillToRequest = query.trim()
    if (!skillToRequest) return
    setDemandLoading(true)
    setDemandError('')
    setDemandSuccess('')
    setDemandTeacher(null)
    setDemandRequestSent(false)
    try {
      const res = await api.requestDemand({ skill_name: skillToRequest })
      if (res.status === 'teacher_available' && res.teacher) {
        setDemandTeacher(res.teacher)
        showToast(res.message || `An eligible teacher (${res.teacher.name}) is already available!`)
      } else {
        setDemandSuccess("We'll notify you when someone qualifies")
        showToast("We'll notify you when someone qualifies")
      }
    } catch (err) {
      setDemandError(err.message || 'Failed to submit demand request')
    } finally {
      setDemandLoading(false)
    }
  }

  async function handleSendDemandTeacherRequest() {
    if (!demandTeacher || demandSubmitting) return
    setDemandSubmitting(true)
    try {
      await api.sendRequest({
        to_user_id: demandTeacher.user_id,
        skill_name: demandTeacher.skill_name,
        message: demandMessage
      })
      setDemandRequestSent(true)
      showToast(`Connection request sent to ${demandTeacher.name}!`)
    } catch (err) {
      setDemandError(err.message || 'Failed to send connection request')
    } finally {
      setDemandSubmitting(false)
    }
  }

  const filteredResults = useMemo(() => {
    if (proficiency === 'All') return results;

    return results.filter(user => {
      let relevantSkills = [];
      if (activeFilter === 'I Want to Learn') {
        relevantSkills = user.teaching_skills;
      } else if (activeFilter === 'I Can Teach') {
        relevantSkills = user.learning_skills;
      } else {
        relevantSkills = [...user.teaching_skills, ...user.learning_skills];
      }

      return relevantSkills.some(s => {
        if (proficiency === 'Expert') return s.level === 'Expert';
        if (proficiency === 'Advanced') return s.level === 'Advanced' || s.level === 'Expert';
        if (proficiency === 'Intermediate') return s.level === 'Intermediate' || s.level === 'Advanced' || s.level === 'Expert';
        return true;
      });
    });
  }, [results, proficiency, activeFilter]);

  const CATEGORIES = ['Java', 'Python', 'React', 'Data Science', 'Machine Learning', 'Figma', 'JavaScript']

  function clearAll() {
    setQuery('')
    setActiveFilter('All')
    setProficiency('All')
    setDemandSuccess('')
    setDemandTeacher(null)
    setDemandError('')
    setDemandMessage('')
    setDemandRequestSent(false)
    if (searchParams.get('q')) {
      setSearchParams({})
    } else {
      runSearch('', 'All')
    }
  }

  return (
    <div className="sv-market">
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '44px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* header + search */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
              <span className="eb">DISCOVER</span>
              <h1 style={{ margin: 0, fontSize: 'clamp(40px, 5vw, 60px)', lineHeight: 1, fontWeight: 900, letterSpacing: '-1.2px' }}>Find your learning partner</h1>
              <p className="muted" style={{ margin: 0, fontSize: 18 }}>Find the perfect peer to teach what you know, or learn what you don't.</p>
            </div>
            <div className="float" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span className="card" style={{ padding: '12px 16px', background: '#D6F3EA', transform: 'rotate(-4deg)', fontWeight: 900, boxShadow: '0 4px 0 #29251F' }}>You teach</span>
              <span style={{ width: 44, height: 44, borderRadius: 999, border: '2px solid #29251F', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, margin: '0 -8px', position: 'relative', zIndex: 1, boxShadow: '0 3px 0 #29251F' }}>⇄</span>
              <span className="card" style={{ padding: '12px 16px', background: '#E6DDF6', transform: 'rotate(3deg)', fontWeight: 900, boxShadow: '0 4px 0 #29251F' }}>They teach</span>
            </div>
          </div>

          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <form className="sform" style={{ display: 'flex', gap: 12 }} role="search" onSubmit={handleSearchSubmit}>
              <label style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-5-5" /></svg>
                </span>
                <input
                  className="in"
                  style={{ paddingLeft: 46, minHeight: 54, fontSize: 16 }}
                  placeholder="Search by skill (e.g. React) or name..."
                  aria-label="Search by skill or name"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </label>
              <button type="submit" className="btn btn-p" style={{ minHeight: 54, padding: '0 34px' }}>Search</button>
            </form>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="eb" style={{ marginRight: 4 }}>POPULAR</span>
              {CATEGORIES.map(c => (
                <button key={c} type="button" className="chip" onClick={() => handleCategoryClick(c)}>{c}</button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 18, borderTop: '2px dashed #E2D3BB' }}>
              <div className="seg" role="group" aria-label="Show">
                {['All', 'I Want to Learn', 'I Can Teach'].map(f => (
                  <button
                    key={f}
                    type="button"
                    className={activeFilter === f ? 'on' : ''}
                    aria-pressed={activeFilter === f}
                    onClick={() => handleFilterChange(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="eb">MIN LEVEL</span>
                <select
                  className="in"
                  style={{ width: 180, minHeight: 46 }}
                  value={proficiency}
                  onChange={e => setProficiency(e.target.value)}
                >
                  {['All', 'Intermediate', 'Advanced', 'Expert'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
            </div>
          </div>
        </section>

        {error && (
          <div className="card" style={{ padding: '14px 18px', background: '#F6DDD8', borderColor: '#9A2B1E', color: '#9A2B1E', fontWeight: 700 }}>{error}</div>
        )}

        {/* Skill circle suggestions section */}
        {circleSuggestions.length > 0 && (
          <section className="card" style={{ padding: '24px 28px', background: '#FFFDF8', border: '2px solid #29251F', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, border: '2px solid #29251F', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, boxShadow: '0 3px 0 #29251F' }}>🔄</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>Skill Circle Suggestions</h2>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>No direct match? Learn in a 3-way circular exchange where everyone gives and gets a skill!</p>
                </div>
              </div>
              <span className="pill" style={{ background: '#D6F3EA' }}>{circleSuggestions.length} CIRCLE{circleSuggestions.length === 1 ? '' : 'S'} FOUND</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {circleSuggestions.map((cycle, cIdx) => {
                // cycle has legs: [A->B, B->C, C->A]
                const legs = cycle.legs || []
                return (
                  <div
                    key={cIdx}
                    className="card"
                    style={{
                      padding: 20,
                      background: '#FDFBF7',
                      border: '2px solid #29251F',
                      borderRadius: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      boxShadow: '0 3px 0 #D2BEA0, 0 5px 0 #29251F'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="eb" style={{ color: '#29251F' }}>3-WAY LOOP (A → B → C → A)</span>
                      {cycle.total_score && (
                        <span className="pill" style={{ background: '#FBEFC4', fontSize: 11 }}>★ Score: {cycle.total_score}</span>
                      )}
                    </div>

                    {/* Loop Representation */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {legs.map((leg, lIdx) => (
                        <div
                          key={lIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            border: '2px solid #29251F',
                            borderRadius: 10,
                            background: lIdx === 0 ? '#D6F3EA' : lIdx === 1 ? '#E6DDF6' : '#FBEFC4',
                            fontSize: 13,
                            fontWeight: 700,
                            gap: 8
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                flex: 'none',
                                borderRadius: 999,
                                border: '2px solid #29251F',
                                background: '#FFFDF8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 900
                              }}
                            >
                              {(leg.teacher_name || '?')[0]}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 85 }}>
                              {leg.teacher_id === user?.id ? 'You' : leg.teacher_name}
                            </span>
                            <span style={{ color: '#6E6455' }}>teaches</span>
                            <span className="pill" style={{ background: '#FFFDF8', padding: '0 8px', height: 24, fontSize: 11 }}>
                              {leg.skill_name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13 }}>→</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                              {leg.learner_id === user?.id ? 'You' : leg.learner_name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn btn-p"
                      style={{ width: '100%', minHeight: 44, fontSize: 14 }}
                      disabled={proposingCycleId !== null}
                      onClick={() => handleProposeCircle(cycle, cIdx)}
                    >
                      {proposingCycleId === cIdx ? 'Proposing circle…' : 'Propose circle 🔄'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* results */}
        {loading ? (
          <div className="grid" aria-busy="true">
            <div className="sk" style={{ height: 460 }} />
            <div className="sk" style={{ height: 460 }} />
            <div className="sk" style={{ height: 460 }} />
            <div className="sk" style={{ height: 460 }} />
          </div>
        ) : filteredResults.length === 0 ? (
          demandTeacher ? (
            <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: '16px 20px', background: '#D6F3EA', borderColor: '#29251F', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 3px 0 #29251F' }}>
                <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 999, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>✓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 15, display: 'block', color: '#29251F' }}>Eligible Teacher Found!</strong>
                  <span style={{ fontSize: 13, color: '#4A443A' }}>An eligible teacher is already available for <strong>{demandTeacher.skill_name}</strong>. Connect with them directly below:</span>
                </div>
              </div>

              <article className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <span className="pill stamp" style={{ position: 'absolute', top: -14, right: 20, height: 32, transform: 'rotate(3deg)', boxShadow: '0 3px 0 #29251F', background: 'var(--acc)' }}>
                  ★ ELIGIBLE TEACHER
                </span>
                <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{
                      width: 68, height: 68, flex: 'none', borderRadius: 999, border: '2px solid #29251F',
                      background: '#E6DDF6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, boxShadow: '0 4px 0 #29251F'
                    }}>
                      {(demandTeacher.name || '?')[0]}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{demandTeacher.name}</h3>
                      {demandTeacher.college && <span className="eb" style={{ fontSize: 11 }}>{demandTeacher.college}</span>}
                      <span className="pill" style={{ alignSelf: 'flex-start', background: '#D6F3EA' }}>
                        {demandTeacher.level_num ? `LEVEL ${demandTeacher.level_num}` : 'QUALIFIED'}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: 14, border: '2px solid #29251F', borderRadius: 14, background: '#D6F3EA', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="eb" style={{ color: '#29251F' }}>CAN TEACH</span>
                    <span className="srow">
                      {demandTeacher.skill_name}
                      <span className="lv" style={{ background: '#FFFDF8' }}>
                        {demandTeacher.level_num ? `LVL ${demandTeacher.level_num}` : 'ELIGIBLE'}
                      </span>
                    </span>
                  </div>
                </div>

                <div style={{ padding: '20px 26px 24px', borderTop: '2px solid #29251F', background: '#F0E5D2', borderRadius: '0 0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="eb" style={{ color: '#29251F' }}>CONNECT REQUEST</span>
                  {demandRequestSent ? (
                    <div style={{ minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '2px dashed #29251F', borderRadius: 10, background: '#D6F3EA', fontWeight: 800 }}>
                      <span>✓</span> Connection Request Sent!
                    </div>
                  ) : (
                    <>
                      <input
                        className="in"
                        placeholder={`Hi ${(demandTeacher.name || '').split(' ')[0]}, let's connect!`}
                        aria-label="Message (optional)"
                        value={demandMessage}
                        onChange={(e) => setDemandMessage(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleSendDemandTeacherRequest}
                        disabled={demandSubmitting}
                        className="btn btn-p"
                        style={{ width: '100%' }}
                      >
                        {demandSubmitting ? 'Sending…' : 'Send Connection Request'}
                      </button>
                    </>
                  )}
                </div>
              </article>
              <button type="button" className="btn btn-s" style={{ alignSelf: 'center' }} onClick={clearAll}>
                ← Back to All Teachers
              </button>
            </div>
          ) : demandSuccess ? (
            <div className="card" style={{ maxWidth: 640, margin: '0 auto', width: '100%', padding: '44px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <span style={{ width: 72, height: 72, borderRadius: 20, border: '2px solid #29251F', background: '#D6F3EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 4px 0 #29251F' }}>
                ✓
              </span>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>We'll notify you when someone qualifies</h2>
              <p className="muted" style={{ margin: 0, fontSize: 15, maxWidth: 480 }}>
                We've registered your interest in <strong>{query.trim()}</strong> and notified qualified community members. You'll get an alert as soon as a teacher is available.
              </p>
              <button type="button" className="btn btn-s" style={{ marginTop: 8 }} onClick={clearAll}>
                Search Other Skills
              </button>
            </div>
          ) : (
            <div className="card" style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
              <span style={{ width: 80, height: 80, borderRadius: 22, border: '2px solid #29251F', background: '#FBEFC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, transform: 'rotate(-5deg)', boxShadow: '0 5px 0 #29251F' }}>
                🔍
              </span>
              <h2 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 900 }}>
                No teacher available right now{query.trim() ? ` for "${query.trim()}"` : ''}
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: 16, maxWidth: 520 }}>
                {query.trim()
                  ? `No verified teacher is currently available for "${query.trim()}". Request this skill and we'll notify you as soon as someone qualifies!`
                  : activeFilter === 'I Want to Learn' ? 'No one currently teaches those skills with your selected filters.'
                    : activeFilter === 'I Can Teach' ? 'No partners are currently looking to learn those skills.'
                      : 'Adjust your search or clear filters to see more results.'}
              </p>

              {demandError && (
                <div className="card" style={{ width: '100%', maxWidth: 480, padding: '12px 16px', background: '#F6DDD8', borderColor: '#9A2B1E', color: '#9A2B1E', fontWeight: 700, fontSize: 14 }}>
                  {demandError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {query.trim() && (
                  <button
                    type="button"
                    className="btn btn-p"
                    disabled={demandLoading}
                    onClick={handleDemandRequest}
                  >
                    {demandLoading ? 'Checking availability…' : "Notify me when one's available"}
                  </button>
                )}
                {(activeFilter !== 'All' || proficiency !== 'All' || query) && (
                  <button type="button" className="btn btn-s" onClick={clearAll}>
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800 }}><span className="mono">{filteredResults.length}</span> partner{filteredResults.length === 1 ? '' : 's'} found</span>
              <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>Best matches first</span>
            </div>
            <div className="grid">
              {filteredResults.map((teacher, idx) => {
                const ratings = ratingsMap[teacher.user_id]
                const form = formMap[teacher.user_id] || defaultForm()

                let displaySkills = [];
                if (activeFilter === 'I Can Teach') {
                  displaySkills = teacher.learning_skills.map(s => ({ ...s, intent: 'teach' }));
                } else if (activeFilter === 'I Want to Learn') {
                  displaySkills = teacher.teaching_skills.map(s => ({ ...s, intent: 'learn' }));
                } else {
                  const combined = new Map();
                  teacher.teaching_skills.forEach(s => combined.set(s.skill_name, { ...s, intent: 'learn' }));
                  teacher.learning_skills.forEach(s => {
                    if (!combined.has(s.skill_name)) {
                      combined.set(s.skill_name, { ...s, intent: 'teach' });
                    }
                  });
                  displaySkills = Array.from(combined.values());
                }

                let targetSkill = form.target_skill;
                if (!targetSkill && displaySkills.length > 0) {
                  targetSkill = displaySkills[0].skill_name;
                }

                const rel = statusMap[`${teacher.user_id}-${targetSkill}`] || { status: null }
                const perfect = teacher.match_context === 'Perfect skill exchange'
                const hasRating = ratings && ratings.review_count > 0
                const avBg = AV_BG[idx % AV_BG.length]

                return (
                  <article key={teacher.user_id} className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {teacher.match_context && (
                      <span className="pill stamp" style={{ position: 'absolute', top: -14, right: 20, height: 32, transform: 'rotate(3deg)', boxShadow: '0 3px 0 #29251F', background: perfect ? 'var(--acc)' : '#FFFDF8' }}>
                        {perfect ? '★ PERFECT MATCH' : 'STRONG MATCH'}
                      </span>
                    )}
                    <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <span style={{
                          width: 68, height: 68, flex: 'none', borderRadius: 999, border: '2px solid #29251F',
                          background: teacher.profile_picture_url ? `#FFFDF8 url(${teacher.profile_picture_url}) center/cover no-repeat` : avBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, boxShadow: '0 4px 0 #29251F'
                        }}>
                          {teacher.profile_picture_url ? '' : (teacher.name || '?')[0]}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{teacher.name}</h3>
                          {teacher.college && <span className="eb" style={{ fontSize: 11 }}>{teacher.college}</span>}
                          <span className="pill" style={{ alignSelf: 'flex-start', background: hasRating ? '#FBEFC4' : '#F0E5D2' }}>
                            {hasRating ? `★ ${ratings.average_rating.toFixed(1)} (${ratings.review_count})` : 'NEW MEMBER'}
                          </span>
                          {teacher.teacher_stats && teacher.teacher_stats.sessions_taught > 0 && (
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#4A443A', marginTop: 2 }}>
                              {[
                                teacher.teacher_stats.average_rating && teacher.teacher_stats.review_count > 0 ? `★${Number(teacher.teacher_stats.average_rating).toFixed(1)}` : null,
                                teacher.teacher_stats.review_count > 0 ? `${teacher.teacher_stats.review_count} review${teacher.teacher_stats.review_count === 1 ? '' : 's'}` : null,
                                `${teacher.teacher_stats.sessions_taught} session${teacher.teacher_stats.sessions_taught === 1 ? '' : 's'}`
                              ].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {teacher.bio && (
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, paddingLeft: 14, borderLeft: '4px solid var(--acc)' }}>{teacher.bio}</p>
                      )}

                      <div className="ex" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 'auto' }}>
                        <div style={{ padding: 14, border: '2px solid #29251F', borderRadius: 14, background: '#D6F3EA', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span className="eb" style={{ color: '#29251F' }}>CAN TEACH</span>
                          {teacher.teaching_skills.length === 0
                            ? <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>None</span>
                            : teacher.teaching_skills.map(s => (
                              <span key={s.skill_name} className="srow">{s.skill_name}<span className="lv" style={{ background: '#FFFDF8' }}>{String(s.level || '').toUpperCase()}</span></span>
                            ))}
                        </div>
                        <div style={{ padding: 14, border: '2px solid #29251F', borderRadius: 14, background: '#E6DDF6', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span className="eb" style={{ color: '#29251F' }}>WANTS TO LEARN</span>
                          {teacher.learning_skills.length === 0
                            ? <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>None</span>
                            : teacher.learning_skills.map(s => (
                              <span key={s.skill_name} className="srow">{s.skill_name}<span className="lv" style={{ background: '#FFFDF8' }}>{String(s.level === 'Unassessed' ? 'Beginner' : s.level || '').toUpperCase()}</span></span>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* request control */}
                    <div style={{ padding: '20px 26px 24px', borderTop: '2px solid #29251F', background: '#F0E5D2', borderRadius: '0 0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <span className="eb" style={{ color: '#29251F' }}>CONNECT REQUEST</span>
                      <RequestControl
                        rel={rel}
                        teacher={teacher}
                        targetSkill={targetSkill}
                        form={form}
                        displaySkills={displaySkills}
                        submitting={submitting}
                        onFormChange={(field, value) => updateForm(teacher.user_id, field, value)}
                        onSend={() => sendRequest(teacher, targetSkill)}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* toast */}
      {toast && (
        <div role="status" style={{ position: 'fixed', right: 24, bottom: 24, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '2px solid #29251F', borderRadius: 14, background: '#D6F3EA', boxShadow: '0 4px 0 #29251F', fontWeight: 700, zIndex: 10, maxWidth: 380 }}>
          <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 999, border: '2px solid #29251F', background: '#FFFDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</span>
          {toast}
          <button type="button" aria-label="Dismiss" onClick={() => setToast('')} style={{ marginLeft: 6, border: 'none', background: 'transparent', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}

function RequestControl({ rel, teacher, targetSkill, form, displaySkills, onFormChange, onSend, submitting }) {
  const selectedSkillIntent = displaySkills.find(s => s.skill_name === targetSkill)?.intent;
  const isTeachingThem = selectedSkillIntent === 'teach';

  return (
    <>
      {displaySkills.length > 1 ? (
        <select
          className="in"
          style={{ fontWeight: 800 }}
          value={targetSkill}
          onChange={(e) => onFormChange('target_skill', e.target.value)}
        >
          <option value="" disabled>Select a skill...</option>
          {displaySkills.map(s => (
            <option key={s.skill_name} value={s.skill_name}>
              {s.intent === 'teach' ? `I want to teach them ${s.skill_name}` : `I want to learn ${s.skill_name}`}
            </option>
          ))}
        </select>
      ) : displaySkills.length === 1 ? (
        <div style={{ minHeight: 50, display: 'flex', alignItems: 'center', padding: '0 14px', border: '2px solid #29251F', borderRadius: 10, background: '#FFFDF8', boxShadow: 'inset 0 3px 0 #EADFCC', fontWeight: 800, fontSize: 15 }}>
          {isTeachingThem ? 'I want to teach them ' : 'I want to learn '}{targetSkill}
        </div>
      ) : (
        <div style={{ minHeight: 50, display: 'flex', alignItems: 'center', padding: '0 14px', border: '2px dashed #29251F', borderRadius: 10, background: '#FFFDF8', fontWeight: 700, fontSize: 15, color: '#6E6455' }}>
          No specific skills available.
        </div>
      )}

      {rel.status === 'accepted' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className="pill" style={{ background: '#D6F3EA', height: 36, fontSize: 13 }}>✓ Already Connected</span>
          {rel.request_id && (
            <Link to={`/messages?request_id=${rel.request_id}`} className="btn btn-s" style={{ minHeight: 44 }}>Open Chat →</Link>
          )}
        </div>
      ) : rel.status === 'pending' ? (
        <div style={{ minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '2px dashed #29251F', borderRadius: 10, background: '#FBEFC4', fontWeight: 800 }}>
          <span aria-hidden="true">◷</span>Request Pending
        </div>
      ) : isTeachingThem ? (
        // A connection request always makes the SENDER the learner. Sending
        // one for "I want to teach them" made the other person the tutor, so
        // offers to teach aren't sent as requests (proper offer flow: later).
        <div style={{ padding: '12px 14px', border: '2px dashed #29251F', borderRadius: 10, background: '#FBEFC4', fontWeight: 700, fontSize: 14, lineHeight: 1.45 }}>
          {(teacher.name || 'They').split(' ')[0]} wants to learn {targetSkill}. Learners send the request,
          so they'll find you under Discover → I Want to Learn. Pick a skill you want to learn from them to connect now.
        </div>
      ) : (
        <>
          <input
            className="in"
            placeholder={`Hi ${(teacher.name || '').split(' ')[0]}, let's connect!`}
            aria-label="Message (optional)"
            value={form.message}
            onChange={(e) => onFormChange('message', e.target.value)}
            disabled={displaySkills.length === 0}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!targetSkill || submitting || displaySkills.length === 0}
            className={`btn ${(rel.status === 'declined' || rel.status === 'completed') ? 'btn-s' : 'btn-p'}`}
            style={{ width: '100%' }}
          >
            {(rel.status === 'declined' || rel.status === 'completed') ? 'Send Request Again' : 'Send Connection Request'}
          </button>
        </>
      )}
    </>
  )
}
