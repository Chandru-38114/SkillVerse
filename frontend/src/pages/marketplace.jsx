import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
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
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All') // 'All', 'I Want to Learn', 'I Can Teach'
  const [proficiency, setProficiency] = useState('All') // 'All', 'Intermediate', 'Advanced', 'Expert'

  const [results, setResults] = useState([])
  const [mySkills, setMySkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusMap, setStatusMap] = useState({})
  const [formMap, setFormMap] = useState({})
  const [ratingsMap, setRatingsMap] = useState({})
  const [toast, setToast] = useState('')

  const user = getSessionUser()
  const toastTimer = useRef(null)

  useEffect(() => {
    runSearch('', 'All')
    api.mySkills().then(setMySkills).catch(() => {})
  }, [])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function showToast(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 5000)
  }

  async function runSearch(skillQuery, roleFilter) {
    setLoading(true)
    setError('')
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
    runSearch(query, activeFilter)
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
    runSearch(category, activeFilter)
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
    runSearch('', 'All')
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

        {/* results */}
        {loading ? (
          <div className="grid" aria-busy="true">
            <div className="sk" style={{ height: 460 }} />
            <div className="sk" style={{ height: 460 }} />
            <div className="sk" style={{ height: 460 }} />
            <div className="sk" style={{ height: 460 }} />
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="card" style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
            <span style={{ width: 80, height: 80, borderRadius: 22, border: '2px solid #29251F', background: '#FBEFC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, transform: 'rotate(-5deg)', boxShadow: '0 5px 0 #29251F' }}>?</span>
            <h2 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 900 }}>No partners found{query ? ` for "${query}"` : ''}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 16 }}>
              {activeFilter === 'I Want to Learn' ? 'Try adjusting your filters, no one currently teaches those skills.'
                : activeFilter === 'I Can Teach' ? 'No partners are currently looking to learn those skills.'
                  : 'Adjust your search or clear filters to see more results.'}
            </p>
            {(activeFilter !== 'All' || proficiency !== 'All' || query) && (
              <button type="button" className="btn btn-s" style={{ marginTop: 8 }} onClick={clearAll}>Clear All Filters</button>
            )}
          </div>
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
            <Link to={`/chat/${rel.request_id}`} className="btn btn-s" style={{ minHeight: 44 }}>Open Chat →</Link>
          )}
        </div>
      ) : rel.status === 'pending' ? (
        <div style={{ minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '2px dashed #29251F', borderRadius: 10, background: '#FBEFC4', fontWeight: 800 }}>
          <span aria-hidden="true">◷</span>Request Pending
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
