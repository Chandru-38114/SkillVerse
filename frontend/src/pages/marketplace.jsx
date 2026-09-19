import { useEffect, useState, useMemo } from 'react'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import Avatar from '../components/ui/Avatar'

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
      
      // Force status update without reload
      setStatusMap(prev => ({ ...prev, [`${teacher.user_id}-${skillName}`]: { status: 'pending' } }))
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
    <div className="min-h-screen bg-transparent font-body text-ink pb-16 relative z-10">
      <section className="pt-10 pb-8 px-4 sm:px-6 max-w-5xl mx-auto mb-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-brandLight/30 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-3xl mx-auto text-center mb-8 relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 bg-brand/10 rounded-2xl flex items-center justify-center rotate-3 border border-brand/20 shadow-sm">
            <svg className="w-8 h-8 text-brand -rotate-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 text-ink tracking-tight drop-shadow-md">Find Your Learning Partner</h1>
          <p className="text-lg text-clay drop-shadow-sm font-medium">Connect with peers to teach what you know, and learn what you don't.</p>
        </div>

        <div className="max-w-2xl mx-auto relative z-10">
          <form onSubmit={handleSearchSubmit} className="relative shadow-sm mb-6 flex rounded-[2rem] bg-surface/80 backdrop-blur-3xl border border-white focus-within:border-brand/40 focus-within:shadow-[0_4px_24px_-12px_rgba(67,56,202,0.2)] transition-all overflow-hidden p-1.5">
            <div className="pl-5 pr-2 py-3 flex items-center justify-center text-ink/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search by skill (e.g. Java) or person name..."
              className="w-full py-3.5 px-2 bg-transparent text-ink placeholder:text-ink/40 focus:outline-none font-medium"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button type="submit" className="bg-brand hover:bg-brand2 transition-colors text-white px-8 py-3 rounded-2xl font-bold text-sm tracking-wide shadow-sm">
              Search
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="text-xs text-ink/50 font-bold uppercase tracking-wider py-1.5 mr-2">Popular:</span>
            {CATEGORIES.map(c => (
              <button 
                key={c}
                onClick={() => handleCategoryClick(c)}
                className="px-4 py-1.5 text-xs font-semibold rounded-full bg-white/60 backdrop-blur-md border border-white text-ink/70 hover:border-brand/30 hover:text-brand hover:bg-white transition-all shadow-sm"              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/10 pt-6">
            <div className="flex bg-surface/40 backdrop-blur-md p-1 rounded-lg border border-line/20 inline-flex">
              {['All', 'I Want to Learn', 'I Can Teach'].map(f => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${activeFilter === f ? 'bg-brand text-white shadow-sm' : 'text-clay hover:text-ink hover:bg-white/80'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Min Proficiency:</span>
              <select 
                className="input text-sm py-1.5 bg-surface/60 backdrop-blur-md w-auto font-medium border-line/20 text-ink/90"
                value={proficiency}
                onChange={e => setProficiency(e.target.value)}
              >
                {['All', 'Intermediate', 'Advanced', 'Expert'].map(l => (
                  <option key={l} value={l} className="bg-surface text-ink">{l}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full text-center mt-2">
              <p className="text-[10px] text-clay/70 italic">* Availability filtering is not supported (data model currently unavailable).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 max-w-[1200px] mx-auto animate-fade-in stagger-2">
        {error && <div className="alert-error mb-8 max-w-2xl mx-auto">{error}</div>}

        {loading ? (
          <TeacherSkeleton />
        ) : filteredResults.length === 0 ? (
          <EmptyTeachers query={query} filter={activeFilter} proficiency={proficiency} />
        ) : (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
              const staggerClass = `stagger-${(idx % 5) + 1}`;

              return (
                <div key={teacher.user_id} className={`section-panel p-0 overflow-hidden flex flex-col group/teacher animate-slide-up hover:border-brand/30 hover:shadow-[0_8px_30px_-12px_rgba(67,56,202,0.2)] transition-all ${staggerClass}`}>
                  
                  <div className="p-6 flex-1 flex flex-col relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent pointer-events-none" />
                    <div className="flex gap-4 mb-5 relative z-10">
                      <Avatar url={teacher.profile_picture_url} name={teacher.name} size="lg" className="shrink-0" />
                      <div>
                        <h3 className="text-xl font-bold text-ink">{teacher.name}</h3>
                        {teacher.college && <p className="text-xs font-semibold text-clay uppercase tracking-wider mt-0.5">{teacher.college}</p>}
                        <RatingSummary data={ratings} />
                        {teacher.bio && (
                          <p className="mt-2 text-sm text-ink/80 line-clamp-2">
                            {teacher.bio}
                          </p>
                        )}
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
                            <div key={s.skill_name} className="flex flex-col bg-white/60 border border-white px-4 py-2 rounded-xl shadow-sm">
                              <span className="text-sm font-bold text-ink">{s.skill_name}</span> 
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
                            <div key={s.skill_name} className="flex flex-col bg-white/60 border border-white px-4 py-2 rounded-xl shadow-sm">
                              <span className="text-sm font-bold text-ink">{s.skill_name}</span> 
                              <span className="text-[10px] text-brand2 uppercase tracking-wide font-bold">{s.level === 'Unassessed' ? 'Beginner' : s.level}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 bg-lift/40 relative z-10 mt-auto border-t border-white/40">
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
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function RequestControl({ rel, teacher, targetSkill, form, displaySkills, onFormChange, onSend, submitting }) {
  const selectedSkillIntent = displaySkills.find(s => s.skill_name === targetSkill)?.intent;
  const isTeachingThem = selectedSkillIntent === 'teach';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold text-clay uppercase tracking-wider">Connect Request</p>
        {displaySkills.length > 1 ? (
          <select
            className="input text-sm py-2 bg-surface/60 backdrop-blur-md font-medium border-line/20 text-ink/90"
            value={targetSkill}
            onChange={(e) => onFormChange('target_skill', e.target.value)}
          >
            <option value="" disabled className="bg-surface text-ink">Select a skill...</option>
            {displaySkills.map(s => (
              <option key={s.skill_name} value={s.skill_name} className="bg-surface text-ink">
                {s.intent === 'teach' ? `I want to teach them ${s.skill_name}` : `I want to learn ${s.skill_name}`}
              </option>
            ))}
          </select>
        ) : displaySkills.length === 1 ? (
          <p className="text-sm font-medium text-ink bg-surface/60 border border-brand/20 shadow-[0_0_15px_rgba(34,211,238,0.1)] px-3.5 py-2 rounded-lg">
            {isTeachingThem ? 'I want to teach them ' : 'I want to learn '}<span className="font-bold text-brand drop-shadow-sm">{targetSkill}</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-clay bg-surface/40 border border-line/10 px-3.5 py-2 rounded-lg italic">
            No specific skills available for this role.
          </p>
        )}
      </div>

      {rel.status === 'accepted' ? (
        <div className="flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-moss2 bg-mossLight/50 px-3 py-1.5 rounded-full border border-moss/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Already Connected
          </span>
          {rel.request_id && (
            <Link to={`/chat/${rel.request_id}`} className="btn-secondary text-sm font-bold">
              Open Chat
            </Link>
          )}
        </div>
      ) : rel.status === 'pending' ? (
        <div className="text-center pt-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold bg-goldLight/50 px-4 py-2 rounded-full border border-gold/20 w-full justify-center">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Request Pending
          </span>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs text-ink/60 font-semibold mb-1 block">Personal Message</label>
            <input
              className="input text-sm py-2 bg-surface/60 backdrop-blur-md border-line/20 text-ink/90 placeholder:text-ink/40"
              placeholder={`Hi ${teacher.name}, let's connect!`}
              value={form.message}
              onChange={(e) => onFormChange('message', e.target.value)}
              disabled={displaySkills.length === 0}
            />
          </div>

          <button onClick={onSend} disabled={!targetSkill || submitting || displaySkills.length === 0} className="btn-primary w-full mt-2 justify-center">
            {(rel.status === 'declined' || rel.status === 'completed')
              ? 'Send Request Again'
              : 'Send Connection Request'}
          </button>
        </>
      )}
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
    <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
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
    <div className="card p-10 text-center flex flex-col items-center justify-center border-dashed border-2 bg-transparent shadow-none border-line max-w-5xl mx-auto">
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
