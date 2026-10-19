import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import './monacoSetup'

// Monaco language ids for our language names.
const MONACO_LANG = { python: 'python', java: 'java', javascript: 'javascript', sql: 'sql', html: 'html', css: 'css' }

/**
 * The SkillVerse code editor (Monaco, the editor inside VS Code and LeetCode).
 * Auto-indents on Enter (after "def …:", "{", etc.), closes brackets and quotes,
 * colours the code, and runs onRun on Ctrl/Cmd + Enter.
 *
 * restrictPaste: the Skill Arena rule. Pasting text that wasn't copied from this
 * same editor is blocked and reported with onViolation (right-click and drag-drop
 * are switched off too, so there's no other way in).
 */
export default function CodeEditor({
  value, onChange, language = 'python', height = 360, readOnly = false, theme = 'light',
  onRun, restrictPaste = false, onViolation, fontSize = 14, ariaLabel = 'Code editor',
}) {
  const runRef = useRef(onRun)
  const violationRef = useRef(onViolation)
  const changeRef = useRef(onChange)
  useEffect(() => { runRef.current = onRun; violationRef.current = onViolation; changeRef.current = onChange }, [onRun, onViolation, onChange])

  // The editor owns its text while you type. React hands `value` back to us a
  // little later, and by then you may have typed more. Pushing that older value
  // into the editor would eat letters. So we remember what we sent and not yet
  // got back ("pending"): a value from that list is just our own echo. Only a
  // value we never sent is pushed in: a partner's edit, a language switch,
  // Reset, loading saved code.
  const editorRef = useRef(null)
  const lastSentRef = useRef(value ?? '')
  const pendingRef = useRef(new Set())
  useEffect(() => {
    const next = value ?? ''
    if (next === lastSentRef.current) { pendingRef.current.clear(); return }   // caught up
    if (pendingRef.current.has(next)) return                                   // an older echo of our own typing
    pendingRef.current.clear()
    lastSentRef.current = next          // if the editor isn't ready yet, handleMount uses this
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model || model.getValue() === next) return
    editor.pushUndoStop()
    editor.executeEdits('external', [{ range: model.getFullModelRange(), text: next }])  // keeps Ctrl+Z working
    editor.pushUndoStop()
  }, [value])

  function handleMount(editor, monaco) {
    editorRef.current = editor
    const model = editor.getModel()
    if (model && model.getValue() !== lastSentRef.current) model.setValue(lastSentRef.current)
    editor.onDidChangeModelContent(() => {
      const v = editor.getValue()
      if (v === lastSentRef.current) return
      lastSentRef.current = v
      if (pendingRef.current.size < 500) pendingRef.current.add(v)
      changeRef.current?.(v)
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.())
    if (!restrictPaste) return
    const dom = editor.getContainerDomNode()
    let copiedHere = ''
    const remember = () => {
      const sel = editor.getSelection()
      copiedHere = sel && editor.getModel() ? editor.getModel().getValueInRange(sel) : ''
    }
    const onPaste = (e) => {
      const text = e.clipboardData ? e.clipboardData.getData('text') : ''
      if (text !== copiedHere) {
        e.preventDefault()
        e.stopPropagation()
        violationRef.current?.('Pasting external code is not allowed.')
      }
    }
    const block = (e) => { e.preventDefault(); e.stopPropagation() }
    dom.addEventListener('copy', remember, true)
    dom.addEventListener('cut', remember, true)
    dom.addEventListener('paste', onPaste, true)
    dom.addEventListener('drop', block, true)
    editor.onDidDispose(() => {
      dom.removeEventListener('copy', remember, true)
      dom.removeEventListener('cut', remember, true)
      dom.removeEventListener('paste', onPaste, true)
      dom.removeEventListener('drop', block, true)
    })
  }

  const web = language === 'html' || language === 'css'
  return (
    <div role="group" aria-label={ariaLabel} style={{ height, minHeight: 120 }}>
      <Editor
        height="100%"
        language={MONACO_LANG[language] || 'plaintext'}
        defaultValue={value ?? ''}
        onMount={handleMount}
        theme={theme === 'dark' ? 'sv-dark' : 'sv-light'}
        loading={<div className="mono muted" style={{ padding: 16, fontSize: 13 }}>Loading editor…</div>}
        options={{
          readOnly,
          fontSize,
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontLigatures: false,
          tabSize: web || language === 'javascript' ? 2 : 4,
          insertSpaces: true,
          detectIndentation: false,
          autoIndent: 'full',
          formatOnType: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          bracketPairColorization: { enabled: true },
          guides: { indentation: true, bracketPairs: true },
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbersMinChars: 3,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'line',
          smoothScrolling: true,
          wordWrap: 'off',
          contextmenu: !restrictPaste,
          dragAndDrop: !restrictPaste,
          dropIntoEditor: { enabled: !restrictPaste },
          quickSuggestions: { other: true, comments: false, strings: false },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'off',   // Enter always makes a new (auto-indented) line; Tab accepts a suggestion
          stickyScroll: { enabled: false },
          ariaLabel,
        }}
      />
    </div>
  )
}
