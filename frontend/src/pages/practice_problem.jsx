import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import LazyCodeEditor from '../components/code/LazyCodeEditor'
import JudgeResults from '../components/code/JudgeResults'
import SqlTable from '../components/code/SqlTable'
import { LANGUAGE_LABELS } from '../components/code/languages'
import './practice.css'

// Unsent code is kept in this browser per problem and language, so a refresh doesn't lose it.
const draftKey = (slug, lang) => `sv-practice:${slug}:${lang}`
function readDraft(slug, lang) {
  try { return localStorage.getItem(draftKey(slug, lang)) } catch { return null }
}
function writeDraft(slug, lang, code) {
  try { localStorage.setItem(draftKey(slug, lang), code) } catch { /* storage off: fine */ }
}
function clearDraft(slug, lang) {
  try { localStorage.removeItem(draftKey(slug, lang)) } catch { /* fine */ }
}

function Example({ ex, i, sql }) {
  return (
    <div className="ex mono">
      <div style={{ fontWeight: 800, marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>Example {i + 1}</div>
      {sql ? (
        <>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}><b>Data:</b>{'\n'}{ex.input}</div>
          <div><b>Output:</b></div>
          <div style={{ background: '#29251F', borderRadius: 8, padding: 8, marginTop: 4 }}><SqlTable results={[ex.output]} /></div>
        </>
      ) : (
        <>
          <div><b>Input:</b> {ex.input}</div>
          <div><b>Output:</b> {JSON.stringify(ex.output)}</div>
        </>
      )}
    </div>
  )
}

/* One problem, LeetCode style: description on the left, editor + results on the right. */
export default function PracticeProblem() {
  const { slug } = useParams()
  const [p, setP] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [language, setLanguage] = useState('')
  const [code, setCode] = useState('')
  const [leftTab, setLeftTab] = useState('desc')
  const [subs, setSubs] = useState([])
  const [result, setResult] = useState(null)
  const [resultId, setResultId] = useState(0)
  const [running, setRunning] = useState(false)
  const busyRef = useRef(false)

  const initialCode = useCallback((prob, lang) =>
    readDraft(prob.slug, lang) ?? prob.my_code?.[lang] ?? prob.starter[lang] ?? '', [])

  useEffect(() => {
    let alive = true
    api.practiceProblem(slug).then(prob => {
      if (!alive) return
      setP(prob)
      setLanguage(prob.default_language)
      setCode(initialCode(prob, prob.default_language))
    }).catch(err => alive && setLoadError(err.message || 'Problem not found'))
    return () => { alive = false }
  }, [slug, initialCode])

  const loadSubs = useCallback(() => {
    api.practiceSubmissions(slug).then(setSubs).catch(() => {})
  }, [slug])
  useEffect(() => { if (leftTab === 'subs') loadSubs() }, [leftTab, loadSubs])

  const onChange = (v) => { setCode(v); if (p) writeDraft(p.slug, language, v) }

  const switchLanguage = (lang) => {
    setLanguage(lang)
    setCode(initialCode(p, lang))
    setResult(null)
  }

  const resetCode = () => {
    clearDraft(p.slug, language)
    setCode(p.starter[language] || '')
  }

  const go = async (kind) => {
    if (busyRef.current) return
    busyRef.current = true
    setRunning(true)
    try {
      const res = kind === 'submit'
        ? await api.practiceSubmit(slug, language, code)
        : await api.practiceRun(slug, language, code)
      setResult({ ...res, kind, slug })
      setResultId(n => n + 1)
      if (kind === 'submit') {
        if (res.verdict === 'Accepted') setP(prev => ({ ...prev, status: 'solved' }))
        else setP(prev => ({ ...prev, status: prev.status || 'attempted' }))
        if (leftTab === 'subs') loadSubs()
      }
    } catch (err) {
      setResult({ verdict: 'Error', passed: 0, total: 0, results: [], error: err.message || 'Something went wrong.', slug })
      setResultId(n => n + 1)
    } finally {
      busyRef.current = false
      setRunning(false)
    }
  }

  if (loadError) {
    return (
      <div className="sv-prac"><div className="wrap">
        <div className="card empty">{loadError} · <Link to="/practice">Back to problems</Link></div>
      </div></div>
    )
  }
  if (!p || p.slug !== slug) return <div className="sv-prac"><div className="wrap muted">Loading problem…</div></div>
  const shownResult = result && result.slug === slug ? result : null

  const sql = p.kind === 'sql'
  return (
    <div className="sv-prac ws">
      <div className="ws-grid">
        {/* Left: description / submissions */}
        <section className="card pane" aria-label="Problem">
          <div className="pane-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={leftTab === 'desc'} onClick={() => setLeftTab('desc')}>Description</button>
            <button type="button" role="tab" aria-selected={leftTab === 'subs'} onClick={() => setLeftTab('subs')}>My submissions</button>
            <Link to={`/practice?course=${encodeURIComponent(p.course)}`} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, padding: '6px 8px' }}>← All problems</Link>
          </div>
          {leftTab === 'desc' ? (
            <div className="desc">
              <h2>{p.title} {p.status === 'solved' && <span title="Solved">✅</span>}</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                <span className={`pill d-${p.difficulty}`}>{p.difficulty}</span>
                <span className="pill">{p.course}</span>
                {(p.topics || []).map(t => <span key={t} className="pill" style={{ background: '#F0E5D2' }}>{t}</span>)}
              </div>
              <div className="statement">{p.statement}</div>
              {sql && p.schema && (
                <>
                  <h3 style={{ fontSize: 15, marginTop: 18 }}>Tables</h3>
                  <pre className="schema mono">{p.schema}</pre>
                </>
              )}
              {p.examples.map((ex, i) => <Example key={i} ex={ex} i={i} sql={sql} />)}
              {p.constraints?.length > 0 && (
                <>
                  <h3 style={{ fontSize: 15, marginTop: 18 }}>Constraints</h3>
                  <ul className="mono" style={{ fontSize: 13, paddingLeft: 20 }}>{p.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </>
              )}
              <p className="muted" style={{ fontSize: 12, marginTop: 18 }}>
                Run checks the examples. Submit checks all {p.test_count} tests (some hidden).
              </p>
            </div>
          ) : (
            <div className="desc">
              {subs.length === 0 ? <p className="muted">No submissions yet.</p> : subs.map(s => (
                <div key={s.id} className="sub-row">
                  <span style={{ fontWeight: 800, color: s.verdict === 'Accepted' ? '#1E7A55' : '#B3261E' }}>{s.verdict}</span>
                  <span className="mono muted">{LANGUAGE_LABELS[s.language] || s.language} · {s.passed}/{s.total}</span>
                  <button type="button" className="btn btn-s" style={{ minHeight: 30, padding: '0 10px', fontSize: 12 }}
                    onClick={() => { setLanguage(s.language); setCode(s.code); writeDraft(p.slug, s.language, s.code) }}>
                    Load code
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: editor + results */}
        <section className="card pane" aria-label="Code">
          <div className="ed-bar">
            <select value={language} onChange={e => switchLanguage(e.target.value)} aria-label="Language">
              {p.languages.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l] || l}</option>)}
            </select>
            <div className="ed-actions">
              <span className="hint">Ctrl + Enter = Run</span>
              <button type="button" className="btn btn-s" onClick={resetCode} disabled={running} title="Back to the starter code">Reset</button>
              <button type="button" className="btn btn-s" onClick={() => go('run')} disabled={running}>▶ Run</button>
              <button type="button" className="btn btn-p" onClick={() => go('submit')} disabled={running}>Submit</button>
            </div>
          </div>
          <LazyCodeEditor
            key={language}
            height="min(58vh, 560px)"
            language={language}
            value={code}
            onChange={onChange}
            onRun={() => go('run')}
            ariaLabel={`${LANGUAGE_LABELS[language] || language} editor`}
          />
          <div style={{ borderTop: '2px solid #29251F' }}>
            <JudgeResults key={resultId} result={shownResult} running={running}
              emptyText={sql ? 'Run your query to check it on the example data.' : 'Run your code to test it on the examples.'} />
          </div>
        </section>
      </div>
    </div>
  )
}
