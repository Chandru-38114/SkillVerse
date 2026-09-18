import { useEffect, useState, useMemo } from 'react'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'

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

  const user = getSessionUser()

  useEffect(() => {
    runSearch('', 'All')
    api.mySkills().then(setMySkills).catch(() => {})
  }, [])

  async function runSearch(skillQuery, roleFilter) {
    setLoading(true)
    setError('')
    try {
      const data = await api.searchTeachers(skillQuery, roleFilter)
      setResults(data)

      const newStatusMap = {}
      const newRatingsMap = {}
      
      data.forEach(t => {
        newRatingsMap[t.user_id] = {
          average_rating: t.average_rating,
          review_count: t.review_count
        }
        
        t.teaching_skills.forEach(s => {
          const statusObj = t.connection_statuses[s.skill_name]
          if (statusObj) {
            newStatusMap[`${t.user_id}-${s.skill_name}`] = statusObj
          }
        })
      })
      setStatusMap(newStatusMap)
      setRatingsMap(newRatingsMap)

      const newFormMap = {}
      data.forEach(t => {
        t.teaching_skills.forEach(s => {
          const key = `${t.user_id}-${s.skill_name}`
          newFormMap[key] = { ...defaultForm(), target_skill: s.skill_name }
        })
      })
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
    const key = `${teacher.user_id}-${skillName}`
    const form = formMap[key] || defaultForm()
    
    setSubmitting(true)
    try {
      await api.sendRequest({
        to_user_id: teacher.user_id,
        skill_name: skillName,
        message: form.message
      })
      
      // Force status update without reload
      setStatusMap(prev => ({ ...prev, [key]: { status: 'pending' } }))
      alert(`Connection request sent to ${teacher.name}!`)
    } catch (err) {
      alert(err.message)
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

  return (
    <div className="min-h-screen bg-paper font-body text-ink pb-24">
      <section className="pt-16 pb-12 px-4 sm:px-6 max-w-6xl mx-auto border-b border-line/40 mb-8">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-ink tracking-tight">Find Your Learning Partner</h1>
          <p className="text-lg text-ink/70">Connect with peers to teach what you know, and learn what you don't.</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearchSubmit} className="relative shadow-sm mb-6 flex rounded-2xl bg-surface border border-line focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all overflow-hidden">
            <div className="pl-4 pr-2 py-3.5 flex items-center justify-center text-ink/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search by skill (e.g. Java) or person name..."
              className="w-full py-3.5 px-2 bg-transparent text-ink placeholder:text-ink/40 focus:outline-none font-medium"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button type="submit" className="bg-brand hover:bg-brand2 transition-colors text-white px-6 font-bold text-sm tracking-wide">
              Search
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="text-xs text-ink/50 font-bold uppercase tracking-wider py-1.5 mr-2">Popular:</span>
            {CATEGORIES.map(c => (
              <button 
                key={c}
                onClick={() => handleCategoryClick(c)}
                className="px-3 py-1 text-xs font-semibold rounded-full bg-paper border border-line text-ink/70 hover:border-brand hover:text-brand transition-colors"              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/40 pt-6">
            <div className="flex bg-paper p-1 rounded-lg border border-line inline-flex">
              {['All', 'I Want to Learn', 'I Can Teach'].map(f => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeFilter === f ? 'bg-lift text-ink shadow-elev-1 border border-brand/20' : 'text-clay hover:text-ink hover:bg-lift/60'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Min Proficiency:</span>
              <select 
                className="input text-sm py-1.5 bg-lift w-auto font-medium"
                value={proficiency}
                onChange={e => setProficiency(e.target.value)}
              >
                {['All', 'Intermediate', 'Advanced', 'Expert'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full text-center mt-2">
              <p className="text-[10px] text-clay/70 italic">* Availability filtering is not supported (data model currently unavailable).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 max-w-6xl mx-auto">
        {error && <div className="alert-error mb-8 max-w-2xl mx-auto">{error}</div>}

        {loading ? (
          <TeacherSkeleton />
        ) : filteredResults.length === 0 ? (
          <EmptyTeachers query={query} filter={activeFilter} proficiency={proficiency} />
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {filteredResults.map(teacher => {
              const ratings = ratingsMap[teacher.user_id]
              const displaySkills = activeFilter === 'I Can Teach' ? teacher.learning_skills : teacher.teaching_skills
              const targetSkillObj = displaySkills.length > 0 ? displaySkills[0] : null
              const targetSkill = targetSkillObj ? targetSkillObj.skill_name : ''
              
              const key = `${teacher.user_id}-${targetSkill}`
              const rel = statusMap[key] || { status: null }
              const form = formMap[key] || defaultForm()

              return (
                <div key={teacher.user_id} className="card overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex gap-4 mb-6">
                      <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center text-brand text-2xl font-bold shrink-0 border border-brand/20">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-ink">{teacher.name}</h3>
                        {teacher.college && <p className="text-xs font-semibold text-clay uppercase tracking-wider mt-0.5">{teacher.college}</p>}
                        <RatingSummary data={ratings} />
                      </div>
                      
                      {teacher.match_context && (
                        <div className="ml-auto flex items-start">
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-1 rounded">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            {teacher.match_context === "Perfect skill exchange" ? "Perfect Match" : "Strong Match"}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {teacher.match_context && (
                      <div className="mb-5 bg-brand/5 rounded-lg px-4 py-3 border border-brand/10">
                        <p className="text-sm font-medium text-brand flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          {teacher.match_context}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-auto">
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-clay font-bold mb-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-moss"></span>
                          Can Teach
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {teacher.teaching_skills.length === 0 ? <span className="text-xs text-ink/40 italic">None</span> : teacher.teaching_skills.map(s => (
                            <div key={s.skill_name} className="flex flex-col bg-paper px-3 py-1.5 rounded-md border border-line/40">
                              <span className="text-sm font-semibold text-ink">{s.skill_name}</span> 
                              <span className="text-[10px] text-brand uppercase tracking-wide font-bold">{s.level}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-clay font-bold mb-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                          Wants to Learn
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {teacher.learning_skills.length === 0 ? <span className="text-xs text-ink/40 italic">None</span> : teacher.learning_skills.map(s => (
                            <div key={s.skill_name} className="flex flex-col bg-paper px-3 py-1.5 rounded-md border border-line/40">
                              <span className="text-sm font-semibold text-ink">{s.skill_name}</span> 
                              <span className="text-[10px] text-brand2 uppercase tracking-wide font-bold">{s.level === 'Unassessed' ? 'Beginner' : s.level}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border-t border-line/40 bg-lift">
                    <RequestControl
                      rel={rel}
                      teacher={teacher}
                      targetSkill={targetSkill}
                      form={form}
                      submitting={submitting}
                      onFormChange={(field, value) => updateForm(key, field, value)}
                      onSend={() => sendRequest(teacher, targetSkill)}
                      activeFilter={activeFilter}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function RequestControl({ rel, teacher, targetSkill, form, onFormChange, onSend, activeFilter, submitting }) {
  if (rel.status === 'accepted') {
    return (
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-moss2 bg-mossLight/50 px-3 py-1.5 rounded-full border border-moss/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          Connected
        </span>
        {rel.request_id && (
          <Link to={`/chat/${rel.request_id}`} className="btn-secondary text-sm font-bold">
            Open Chat
          </Link>
        )}
      </div>
    )
  }

  if (rel.status === 'pending') {
    return (
      <div className="text-center py-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold bg-goldLight/50 px-4 py-2 rounded-full border border-gold/20">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Request Pending
        </span>
      </div>
    )
  }

  const isTeachingThem = activeFilter === 'I Can Teach';
  const displaySkills = isTeachingThem ? teacher.learning_skills : teacher.teaching_skills;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold text-clay uppercase tracking-wider">Connect Request</p>
        {displaySkills.length > 1 ? (
          <select
            className="input text-sm py-2 bg-lift font-medium"
            value={targetSkill}
            onChange={(e) => onFormChange('target_skill', e.target.value)}
          >
            <option value="" disabled>Select a skill...</option>
            {displaySkills.map(s => (
              <option key={s.skill_name} value={s.skill_name}>
                {isTeachingThem ? `I want to teach them ${s.skill_name}` : `I want to learn ${s.skill_name}`}
              </option>
            ))}
          </select>
        ) : displaySkills.length === 1 ? (
          <p className="text-sm font-medium text-ink bg-surface border border-line px-3.5 py-2 rounded-lg">
            {isTeachingThem ? 'I want to teach them ' : 'I want to learn '}<span className="font-bold text-brand">{targetSkill}</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-clay bg-lift border border-line px-3.5 py-2 rounded-lg italic">
            No specific skills available for this role.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs text-ink/60 font-semibold mb-1 block">Personal Message</label>
        <input
          className="input text-sm py-2 bg-lift"
          placeholder={`Hi ${teacher.name}, let's connect!`}
          value={form.message}
          onChange={(e) => onFormChange('message', e.target.value)}
        />
      </div>

      <button onClick={onSend} disabled={!targetSkill || submitting} className="btn-primary w-full mt-2 justify-center">
        {(rel.status === 'declined' || rel.status === 'completed')
          ? 'Send Request Again'
          : 'Send Connection Request'}
      </button>
    </div>
  )
}

function RatingSummary({ data }) {
  if (!data || data.review_count === 0) return (
    <div className="mt-1 text-[11px] uppercase tracking-wider text-clay font-bold">New member</div>
  )
  const filled = Math.round(data.average_rating)
  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="flex text-[10px]">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg key={s} className={`w-3.5 h-3.5 ${s <= filled ? 'text-gold fill-gold' : 'text-line fill-paper'}`} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </span>
      <span className="text-[11px] text-ink/70 font-bold ml-1">
        {data.average_rating.toFixed(1)} <span className="font-normal text-clay">({data.review_count})</span>
      </span>
    </div>
  )
}

function TeacherSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card overflow-hidden flex flex-col">
          <div className="p-6 flex-1 border-b border-line/40">
            <div className="flex gap-4 mb-6">
              <div className="w-16 h-16 rounded-full skeleton shrink-0" />
              <div className="space-y-2 w-full mt-2">
                <div className="skeleton h-5 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
              <div className="space-y-3">
                <div className="skeleton h-3 w-20 rounded" />
                <div className="skeleton h-8 w-full rounded" />
              </div>
              <div className="space-y-3">
                <div className="skeleton h-3 w-20 rounded" />
                <div className="skeleton h-8 w-full rounded" />
              </div>
            </div>
          </div>
          <div className="p-5 bg-paper/30 h-32 skeleton rounded-none border-t border-line/40" />
        </div>
      ))}
    </div>
  )
}

function EmptyTeachers({ query, filter, proficiency }) {
  let message = 'Adjust your filters or try a different search.'
  if (filter === 'I Want to Learn') message = 'No matching partners found who can teach those skills.'
  if (filter === 'I Can Teach') message = 'No matching partners found who want to learn those skills.'

  return (
    <div className="card p-16 text-center flex flex-col items-center justify-center border-dashed border-2 bg-transparent shadow-none border-line">
      <div className="w-16 h-16 bg-line/30 rounded-full flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-ink mb-2">No partners found{query ? ` for "${query}"` : ''}</h2>
      <p className="text-sm text-clay max-w-sm mx-auto font-medium mb-6">
        {message}
      </p>
      {(filter !== 'All' || proficiency !== 'All' || query) && (
        <button onClick={() => window.location.reload()} className="btn-secondary text-sm font-bold">Clear All Filters</button>
      )}
    </div>
  )
}
