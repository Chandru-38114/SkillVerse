import { useEffect, useState, useMemo } from 'react'
import BackButton from "../components/BackButton";
import { Link } from 'react-router-dom'
import { api, getSessionUser } from '../api'
import Avatar from '../components/ui/Avatar'
import { EmptyStateIllustration } from '../components/illustrations'
import { GradientOrb, DecorativeGrid } from '../components/visuals'
import { FadeIn, StaggerContainer, StaggerItem, Reveal } from '../components/animations'

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
    <div className="min-h-screen bg-paper font-body text-ink pb-24 relative overflow-hidden z-10">
      <DecorativeGrid className="opacity-40" />
      <GradientOrb color="bg-brand2" size="w-[500px] h-[500px]" className="-top-40 -left-20" opacity="opacity-20" />
      <GradientOrb color="bg-brand" size="w-[600px] h-[600px]" className="-right-60 top-40" opacity="opacity-[0.15]" blur="blur-[120px]" />

      <section className="pt-10 pb-8 px-4 sm:px-6 max-w-5xl mx-auto mb-6 relative z-10">
        <Reveal duration={0.6} yOffset={30}>
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 text-ink tracking-tight">Discover Partners</h1>
            <p className="text-lg text-clay font-medium">Find the perfect peer to teach what you know, or learn what you don't.</p>
          </div>
        </Reveal>

        <Reveal duration={0.6} delay={0.1} yOffset={20}>
          <div className="max-w-3xl mx-auto bg-surface border border-line shadow-xl shadow-brand/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
            <form onSubmit={handleSearchSubmit} className="relative mb-8 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ink/40">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by skill (e.g. React) or name..."
                  className="w-full py-4 pl-12 pr-4 bg-paper/50 rounded-xl border border-line focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all text-ink font-medium shadow-inner"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary px-10 py-4 shadow-lg shadow-brand/20 whitespace-nowrap">
                Search
              </button>
            </form>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <span className="text-xs text-clay font-bold uppercase tracking-wider py-1.5 mr-2 flex items-center">Popular:</span>
              {CATEGORIES.map(c => (
                <button 
                  key={c}
                  onClick={() => handleCategoryClick(c)}
                  className="px-4 py-1.5 text-xs font-semibold rounded-full bg-lift border border-line text-ink/80 hover:border-brand/40 hover:text-brandInk hover:bg-brand/5 transition-colors shadow-sm"              
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line/50 pt-6">
              <div className="flex bg-paper p-1 rounded-xl border border-line shadow-inner inline-flex">
                {['All', 'I Want to Learn', 'I Can Teach'].map(f => (
                  <button
                    key={f}
                    onClick={() => handleFilterChange(f)}
                    className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeFilter === f ? 'bg-brand text-white shadow-md' : 'text-clay hover:text-ink hover:bg-lift'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-clay flex items-center">Min Level:</span>
                <select 
                  className="input text-sm py-2.5 bg-paper font-semibold border-line text-ink shadow-sm rounded-xl focus:border-brand/50 focus:ring-2 focus:ring-brand/10 outline-none"
                  value={proficiency}
                  onChange={e => setProficiency(e.target.value)}
                >
                  {['All', 'Intermediate', 'Advanced', 'Expert'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        {error && <div className="alert-error mb-8 max-w-2xl mx-auto">{error}</div>}

        {loading ? (
          <TeacherSkeleton />
        ) : filteredResults.length === 0 ? (
          <FadeIn>
            <div className="card max-w-3xl mx-auto border-dashed border-2 border-line bg-surface/50 backdrop-blur-sm p-12">
              <EmptyStateIllustration 
                message={`No partners found${query ? ` for "${query}"` : ''}`} 
                secondaryMessage={
                  activeFilter === 'I Want to Learn' ? 'Try adjusting your filters, no one currently teaches those skills.' :
                  activeFilter === 'I Can Teach' ? 'No partners are currently looking to learn those skills.' :
                  'Adjust your search or clear filters to see more results.'
                } 
              />
              {(activeFilter !== 'All' || proficiency !== 'All' || query) && (
                <div className="mt-8 flex justify-center">
                  <button onClick={() => window.location.reload()} className="btn-secondary px-8">Clear All Filters</button>
                </div>
              )}
            </div>
          </FadeIn>
        ) : (
          <StaggerContainer staggerDelay={0.1} className="grid lg:grid-cols-2 gap-8 xl:gap-10">
            {filteredResults.map((teacher) => {
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

              return (
                <StaggerItem key={teacher.user_id}>
                  <div className="card p-0 h-full flex flex-col bg-surface border-line hover:border-brand/30 hover:shadow-2xl shadow-brand/5 transition-all duration-300 group overflow-hidden relative">
                    {teacher.match_context && (
                      <div className="absolute top-0 right-0 z-20">
                        <div className="bg-brand text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-bl-xl shadow-md">
                          {teacher.match_context === "Perfect skill exchange" ? "Perfect Match" : "Strong Match"}
                        </div>
                      </div>
                    )}
                    
                    <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
                      <div className="flex gap-5 mb-8 items-start">
                        <Avatar url={teacher.profile_picture_url} name={teacher.name} size="lg" className="shrink-0 ring-4 ring-lift" />
                        <div className="pt-1">
                          <h3 className="text-2xl font-bold text-ink group-hover:text-brandInk transition-colors">{teacher.name}</h3>
                          {teacher.college && <p className="text-xs font-bold text-clay uppercase tracking-widest mt-1">{teacher.college}</p>}
                          <RatingSummary data={ratings} />
                        </div>
                      </div>

                      {teacher.bio && (
                        <p className="mb-6 text-sm text-clay leading-relaxed italic">
                          "{teacher.bio}"
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-auto bg-lift/50 p-5 rounded-2xl border border-line/50">
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-clay font-bold mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand"></span>
                            Can Teach
                          </h4>
                          <div className="flex flex-col gap-2">
                            {teacher.teaching_skills.length === 0 ? <span className="text-xs text-ink/40 italic">None</span> : teacher.teaching_skills.map(s => (
                              <div key={s.skill_name} className="flex justify-between items-center bg-surface border border-line/50 px-3 py-2 rounded-lg">
                                <span className="text-sm font-bold text-ink">{s.skill_name}</span> 
                                <span className="text-[9px] text-brandInk uppercase tracking-widest font-bold bg-brand/10 px-1.5 py-0.5 rounded">{s.level}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-clay font-bold mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand2"></span>
                            Wants to Learn
                          </h4>
                          <div className="flex flex-col gap-2">
                            {teacher.learning_skills.length === 0 ? <span className="text-xs text-ink/40 italic">None</span> : teacher.learning_skills.map(s => (
                              <div key={s.skill_name} className="flex justify-between items-center bg-surface border border-line/50 px-3 py-2 rounded-lg">
                                <span className="text-sm font-bold text-ink">{s.skill_name}</span> 
                                <span className="text-[9px] text-brand2 uppercase tracking-widest font-bold bg-brand2/10 px-1.5 py-0.5 rounded">{s.level === 'Unassessed' ? 'Beginner' : s.level}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 md:p-8 bg-lift border-t border-line relative z-10">
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
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        )}
      </section>
    </div>
  )
}

function RequestControl({ rel, teacher, targetSkill, form, displaySkills, onFormChange, onSend, submitting }) {
  const selectedSkillIntent = displaySkills.find(s => s.skill_name === targetSkill)?.intent;
  const isTeachingThem = selectedSkillIntent === 'teach';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-clay uppercase tracking-widest">Connect Request</p>
        {displaySkills.length > 1 ? (
          <select
            className="input text-sm py-2.5 bg-surface font-bold border-line text-ink shadow-sm rounded-xl focus:border-brand/50 focus:ring-2 focus:ring-brand/10 outline-none"
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
          <p className="text-sm font-bold text-ink bg-surface border border-line shadow-sm px-4 py-3 rounded-xl flex items-center">
            {isTeachingThem ? 'I want to teach them ' : 'I want to learn '}<span className="ml-1 text-brandInk">{targetSkill}</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-clay bg-surface border border-line/50 px-4 py-3 rounded-xl italic">
            No specific skills available.
          </p>
        )}
      </div>

      {rel.status === 'accepted' ? (
        <div className="flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
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
        <div className="pt-2">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 w-full justify-center">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Request Pending
          </span>
        </div>
      ) : (
        <>
          <div>
            <input
              className="input text-sm py-3 bg-surface border-line text-ink placeholder:text-ink/30 rounded-xl focus:border-brand/50 focus:ring-2 focus:ring-brand/10 outline-none shadow-inner"
              placeholder={`Hi ${teacher.name.split(' ')[0]}, let's connect!`}
              value={form.message}
              onChange={(e) => onFormChange('message', e.target.value)}
              disabled={displaySkills.length === 0}
            />
          </div>

          <button onClick={onSend} disabled={!targetSkill || submitting || displaySkills.length === 0} className="btn-primary w-full py-3 shadow-md shadow-brand/20">
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
    <div className="mt-2 text-[10px] uppercase tracking-widest text-clay font-bold bg-lift inline-block px-2 py-1 rounded">New member</div>
  )
  const filled = Math.round(data.average_rating)
  return (
    <div className="flex items-center gap-1.5 mt-2 bg-lift inline-flex px-2.5 py-1 rounded-lg border border-line/50">
      <span className="flex text-[10px]">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg key={s} className={`w-3.5 h-3.5 ${s <= filled ? 'text-amber-400 fill-amber-400' : 'text-line fill-paper'}`} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </span>
      <span className="text-xs text-ink font-bold">
        {data.average_rating.toFixed(1)} <span className="font-semibold text-clay/70">({data.review_count})</span>
      </span>
    </div>
  )
}

function TeacherSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-8 xl:gap-10">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-0 overflow-hidden flex flex-col border-line shadow-sm">
          <div className="p-6 md:p-8 flex-1">
            <div className="flex gap-5 mb-8">
              <div className="w-16 h-16 rounded-full skeleton shrink-0" />
              <div className="space-y-3 w-full mt-1">
                <div className="skeleton h-6 w-1/3 rounded-lg" />
                <div className="skeleton h-3 w-1/4 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 bg-lift/50 p-5 rounded-2xl border border-line/50">
              <div className="space-y-4">
                <div className="skeleton h-3 w-20 rounded-lg" />
                <div className="skeleton h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-4">
                <div className="skeleton h-3 w-20 rounded-lg" />
                <div className="skeleton h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
          <div className="p-6 md:p-8 bg-lift h-40 skeleton rounded-none border-t border-line" />
        </div>
      ))}
    </div>
  )
}
