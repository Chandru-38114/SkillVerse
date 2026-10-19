import { useState } from 'react'
import SqlTable from './SqlTable'

// Colours of each verdict (dark console background).
const VERDICT_COLOR = {
  'Accepted': '#7FE0B8',
  'Wrong Answer': '#FF9B86',
  'Runtime Error': '#FF9B86',
  'Compile Error': '#FFC46B',
  'Time Limit Exceeded': '#FFC46B',
  'Runner Unavailable': '#B9AE9C',
  'Runner Busy': '#B9AE9C',
  'No Code': '#B9AE9C',
}

function isTable(v) {
  return v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.columns)
}

function Value({ v }) {
  if (isTable(v)) return <SqlTable results={[v]} />
  let text
  try { text = JSON.stringify(v) } catch { text = String(v) }
  return <code className="mono" style={{ color: '#F8F3E9', wordBreak: 'break-all' }}>{text === undefined ? 'null' : text}</code>
}

/**
 * The result panel after Run / Submit, like LeetCode's:
 *   verdict + "3 / 5 test cases passed", then one tab per test case with its
 *   input, your output and the expected output (hidden tests show only pass/fail).
 */
export default function JudgeResults({ result, running, emptyText = 'Run your code to test it on the examples.' }) {
  const [tab, setTab] = useState(0)
  const box = { background: '#1F1C17', color: '#D6F3EA', padding: '14px 16px', minHeight: 110, fontSize: 13 }

  if (running) return <div style={box} className="mono" aria-live="polite">Running your code…</div>
  if (!result) return <div style={{ ...box, color: '#8C8273' }} className="mono">{emptyText}</div>

  const results = result.results || []
  const cur = results[Math.min(tab, results.length - 1)]
  const color = VERDICT_COLOR[result.verdict] || '#F8F3E9'
  return (
    <div style={box} aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ color, fontSize: 18 }}>{result.verdict}</strong>
        {result.total > 0 && <span className="mono" style={{ color: '#B9AE9C', fontSize: 12 }}>{result.passed} / {result.total} test cases passed</span>}
        {result.points > 0 && <span style={{ color: '#FFC46B', fontWeight: 800, fontSize: 13 }}>+{result.points} points</span>}
      </div>

      {result.error && (
        <pre className="mono" style={{ color: '#FF9B86', whiteSpace: 'pre-wrap', marginTop: 10, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>{result.error}</pre>
      )}

      {results.length > 0 && (
        <>
          <div role="tablist" aria-label="Test cases" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {results.map((r, i) => (
              <button key={r.index} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)}
                className="mono"
                style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${i === tab ? '#F8F3E9' : '#4A4236'}`,
                  background: i === tab ? '#3A352D' : 'transparent',
                  color: r.passed ? '#7FE0B8' : '#FF9B86',
                }}>
                {r.passed ? '✓' : '✗'} {r.sample ? `Case ${r.index}` : `Hidden ${r.index}`}
              </button>
            ))}
          </div>
          {cur && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <div><div style={{ color: '#8C8273', fontSize: 11, fontWeight: 800 }}>INPUT</div><code className="mono" style={{ color: '#F8F3E9', wordBreak: 'break-all' }}>{cur.input}</code></div>
              {'output' in cur && <div><div style={{ color: '#8C8273', fontSize: 11, fontWeight: 800 }}>YOUR OUTPUT</div><Value v={cur.output} /></div>}
              {'expected' in cur && <div><div style={{ color: '#8C8273', fontSize: 11, fontWeight: 800 }}>EXPECTED</div><Value v={cur.expected} /></div>}
              {cur.error && <div><div style={{ color: '#8C8273', fontSize: 11, fontWeight: 800 }}>ERROR</div><pre className="mono" style={{ color: '#FF9B86', whiteSpace: 'pre-wrap', fontSize: 12 }}>{cur.error}</pre></div>}
              {!cur.sample && !('expected' in cur) && <div style={{ color: '#8C8273', fontSize: 12 }}>Hidden test: the answer is kept secret, like on LeetCode.</div>}
            </div>
          )}
        </>
      )}

      {result.output && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: '#8C8273', fontSize: 11, fontWeight: 800 }}>STDOUT (your print statements)</div>
          <pre className="mono" style={{ color: '#D6F3EA', whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 160, overflow: 'auto' }}>{result.output}</pre>
        </div>
      )}
    </div>
  )
}
