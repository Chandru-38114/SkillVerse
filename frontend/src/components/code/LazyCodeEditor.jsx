import { lazy, Suspense } from 'react'

// The editor is big (~1–2 MB), so it's only downloaded on pages that show code.
const CodeEditor = lazy(() => import('./CodeEditor'))

export default function LazyCodeEditor(props) {
  const h = props.height || 360
  return (
    <Suspense fallback={<div className="mono muted" style={{ height: h, padding: 16, fontSize: 13, background: props.theme === 'dark' ? '#29251F' : '#FFFDF8' }}>Loading editor…</div>}>
      <CodeEditor {...props} />
    </Suspense>
  )
}
