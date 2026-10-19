import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Live preview for HTML / CSS / JavaScript, like CodePen.
 * The page runs in a SANDBOXED iframe without "allow-same-origin": it gets its
 * own empty origin, so it can't read SkillVerse's login token, cookies or pages.
 * console.log / errors are passed back with postMessage and shown underneath.
 */
const CONSOLE_BRIDGE = `<script>(function(){
  var send = function(kind, args){ try { parent.postMessage({ __svPreview: true, kind: kind,
    text: Array.prototype.map.call(args, function(a){ try { return typeof a === 'string' ? a : JSON.stringify(a); } catch(e){ return String(a); } }).join(' ') }, '*'); } catch(e){} };
  ['log','info','warn','error'].forEach(function(k){ var o = console[k]; console[k] = function(){ send(k, arguments); o && o.apply(console, arguments); }; });
  window.addEventListener('error', function(e){ send('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]); });
})();</script>`

function buildDoc({ html, css, js }) {
  const safeJs = String(js || '').replace(/<\/script/gi, '<\\/script')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${String(css || '').replace(/<\/style/gi, '<\\/style')}</style>${CONSOLE_BRIDGE}</head>
<body>${html || ''}<script>${safeJs}</script></body></html>`
}

export default function WebPreview({ html, css, js, height = 320, runKey = 0 }) {
  const frameRef = useRef(null)
  const [logs, setLogs] = useState([])
  const [doc, setDoc] = useState(() => buildDoc({ html, css, js }))

  // Re-render shortly after typing stops (and immediately when Run is pressed).
  useEffect(() => {
    const t = setTimeout(() => { setLogs([]); setDoc(buildDoc({ html, css, js })) }, runKey ? 0 : 500)
    return () => clearTimeout(t)
  }, [html, css, js, runKey])

  useEffect(() => {
    const onMsg = (e) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      if (!e.data || !e.data.__svPreview) return
      setLogs(l => [...l.slice(-49), { kind: e.data.kind, text: String(e.data.text).slice(0, 2000) }])
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const key = useMemo(() => doc.length + ':' + runKey, [doc, runKey])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '2px solid #29251F', borderRadius: 12, overflow: 'hidden', background: '#FFFDF8' }}>
      <div className="mono" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 800, background: '#F0E5D2', borderBottom: '2px solid #29251F' }}>LIVE PREVIEW</div>
      <iframe
        key={key}
        ref={frameRef}
        title="Web page preview"
        sandbox="allow-scripts allow-modals"
        srcDoc={doc}
        style={{ width: '100%', height, border: 'none', background: '#fff' }}
      />
      <div className="mono" style={{ borderTop: '2px dashed #D9CBB2', padding: '8px 12px', maxHeight: 140, overflow: 'auto', fontSize: 12, background: '#1F1C17', color: '#D6F3EA', minHeight: 44 }}>
        {logs.length === 0
          ? <span style={{ color: '#8C8273' }}>Console: console.log() output appears here</span>
          : logs.map((l, i) => <div key={i} style={{ color: l.kind === 'error' ? '#FF9B86' : l.kind === 'warn' ? '#FBEFC4' : '#D6F3EA', whiteSpace: 'pre-wrap' }}>{l.kind === 'error' ? '✖ ' : '› '}{l.text}</div>)}
      </div>
    </div>
  )
}
