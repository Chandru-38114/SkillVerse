// Loads ONLY what SkillVerse needs from Monaco (the VS Code editor): the editor
// core, its standard features (find, folding, bracket matching, auto-indent…)
// and six languages. The full package would add several megabytes.
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/features/register.all'
import 'monaco-editor/languages/definitions/python/register'
import 'monaco-editor/languages/definitions/java/register'
import 'monaco-editor/languages/definitions/javascript/register'
import 'monaco-editor/languages/definitions/sql/register'
import 'monaco-editor/languages/definitions/html/register'
import 'monaco-editor/languages/definitions/css/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import { loader } from '@monaco-editor/react'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })   // use this bundled copy, not a CDN

// SkillVerse colours: cream paper for normal pages, warm ink for the Arena.
monaco.editor.defineTheme('sv-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8C8273', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C2410C', fontStyle: 'bold' },
    { token: 'string', foreground: '2E7D63' },
    { token: 'number', foreground: '7C3AED' },
    { token: 'type', foreground: '1D4ED8' },
  ],
  colors: {
    'editor.background': '#FFFDF8',
    'editor.lineHighlightBackground': '#F8F3E9',
    'editorLineNumber.foreground': '#B9AE9C',
    'editorLineNumber.activeForeground': '#29251F',
    'editorCursor.foreground': '#FF8A3D',
    'editor.selectionBackground': '#FFD9BF',
    'editorIndentGuide.background1': '#EFE6D6',
    'editorIndentGuide.activeBackground1': '#D9CBB2',
  },
})
monaco.editor.defineTheme('sv-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '9C9282', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'FF9E5E', fontStyle: 'bold' },
    { token: 'string', foreground: '7FD4B4' },
    { token: 'number', foreground: 'C4B5FD' },
    { token: 'type', foreground: '93C5FD' },
  ],
  colors: {
    'editor.background': '#29251F',
    'editor.lineHighlightBackground': '#332E27',
    'editorLineNumber.foreground': '#6E6455',
    'editorLineNumber.activeForeground': '#F8F3E9',
    'editorCursor.foreground': '#FF8A3D',
    'editor.selectionBackground': '#5A4A3A',
    'editorIndentGuide.background1': '#3A352D',
  },
})

export default monaco
