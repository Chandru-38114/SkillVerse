import { useState, useRef, useEffect, useContext } from 'react';
import { api, getSessionUser } from '../api';
import { SessionWebSocketContext } from './VideoChat';
import LazyCodeEditor from './code/LazyCodeEditor';
import WebPreview from './code/WebPreview';
import SqlTable from './code/SqlTable';
import { LANGUAGE_LABELS, HELLO, USES_STDIN, parseWeb } from './code/languages';

const LANGS = ['python', 'java', 'javascript', 'sql', 'web'];

function sqlToText(results) {
  if (!results || !results.length) return '';
  return results.map(r => r.columns
    ? [r.columns.join(' | '), ...r.rows.map(row => row.map(v => (v === null ? 'NULL' : String(v))).join(' | '))].join('\n')
    : r.message).join('\n\n');
}

/**
 * The shared code editor of the Learning Arena (tutor and learner see the same code).
 * - Language switch (Python, Java, JavaScript, SQL, HTML/CSS/JS) is shared too.
 * - Each language keeps its own draft, so switching back restores your code.
 * - Python & SQL run on the SkillVerse server; Java & JavaScript on the code runner;
 *   HTML/CSS/JS run only in this browser, in a sealed preview.
 */
export default function Compiler({ sessionId }) {
  const user = getSessionUser();
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(HELLO.python);
  const draftsRef = useRef({});
  const [stdin, setStdin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [webTab, setWebTab] = useState('html');
  const [previewRun, setPreviewRun] = useState(0);

  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [sqlResult, setSqlResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const [syncStatus, setSyncStatus] = useState('🟢 Connected');
  const [saveStatus, setSaveStatus] = useState('');
  const wsRef = useRef(null);
  const sharedWs = useContext(SessionWebSocketContext);
  const [remoteRunIndicator, setRemoteRunIndicator] = useState(null);
  const versionRef = useRef(0);
  const myIdRef = useRef(user?.id);
  const execTimestampRef = useRef(0);
  const languageRef = useRef('python');
  useEffect(() => { languageRef.current = language; }, [language]);

  // 1. Load the saved editor (language, code and every language's draft).
  useEffect(() => {
    let alive = true;
    api.getCompilerState(sessionId).then(res => {
      if (!alive || !res) return;
      const lang = LANGS.includes(res.language) ? res.language : 'python';
      draftsRef.current = res.drafts || {};
      versionRef.current = res.version || 0;
      setLanguage(lang);
      setCode(res.version ? res.code : HELLO[lang]);
    }).catch(err => console.error('Failed to load compiler state', err));
    return () => { alive = false; };
  }, [sessionId]);

  // 2. Live updates from the partner over the shared session socket.
  useEffect(() => {
    if (!sharedWs) { setSyncStatus('🔴 Disconnected'); return; }
    wsRef.current = sharedWs;
    setSyncStatus(sharedWs.readyState === WebSocket.OPEN ? '🟢 Connected' : '🟡 Connecting...');

    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update_code' && msg.code !== undefined) {
          // Newer version wins; on a tie the higher user id wins, so both sides agree.
          const v = Number(msg.version) || 0;
          const newer = v > versionRef.current ||
            (v === versionRef.current && Number(msg.user_id) > Number(myIdRef.current));
          if (!newer) return;
          versionRef.current = v;
          const lang = LANGS.includes(msg.language) ? msg.language : languageRef.current;
          if (lang !== languageRef.current) setLanguage(lang);
          draftsRef.current = { ...draftsRef.current, [lang]: msg.code };
          setCode(msg.code);
        } else if (msg.type === 'execution_result') {
          if (msg.timestamp && msg.timestamp <= execTimestampRef.current) return;
          execTimestampRef.current = msg.timestamp || Date.now();
          setSqlResult(null);
          setOutput(msg.output || '');
          setError(msg.error || '');
          if (msg.user_name) {
            setRemoteRunIndicator(`${msg.user_name} ran the code`);
            setTimeout(() => setRemoteRunIndicator(null), 3000);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    const onOpen = () => setSyncStatus('🟢 Connected');
    const onClose = () => setSyncStatus('🔴 Disconnected');
    sharedWs.addEventListener('message', handleMessage);
    sharedWs.addEventListener('open', onOpen);
    sharedWs.addEventListener('close', onClose);
    return () => {
      sharedWs.removeEventListener('message', handleMessage);
      sharedWs.removeEventListener('open', onOpen);
      sharedWs.removeEventListener('close', onClose);
    };
  }, [sharedWs]);

  // Persist (debounced) so a refresh or a late joiner doesn't lose anything.
  const saveTimerRef = useRef(null);
  const scheduleSave = (newCode, lang) => {
    clearTimeout(saveTimerRef.current);
    setSaveStatus('Saving…');
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.saveCompilerState(sessionId, newCode, lang);
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        console.error('Failed to save compiler state', err);
        setSaveStatus('Not saved');
      }
    }, 1000);
  };
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const broadcast = (newCode, lang) => {
    // Hybrid clock: always moves forward and survives a page refresh.
    versionRef.current = Math.max(versionRef.current + 1, Date.now());
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_code', code: newCode, language: lang, version: versionRef.current, user_id: user?.id }));
    }
    scheduleSave(newCode, lang);
  };

  const handleEditorChange = (newCode) => {
    // (The editor only calls this for YOUR typing; a partner's edit arriving never echoes back.)
    setCode(newCode);
    draftsRef.current = { ...draftsRef.current, [language]: newCode };
    broadcast(newCode, language);
  };

  const switchLanguage = (lang) => {
    if (lang === language) return;
    draftsRef.current = { ...draftsRef.current, [language]: code };
    const next = draftsRef.current[lang] || HELLO[lang];
    setLanguage(lang);
    setCode(next);
    setOutput(''); setError(''); setSqlResult(null);
    broadcast(next, lang);
  };

  // HTML / CSS / JS workspace is stored as one JSON string.
  const web = language === 'web' ? parseWeb(code) : null;
  const setWebPart = (part, text) => handleEditorChange(JSON.stringify({ ...web, [part]: text }));

  const shareResult = (out, err) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const ts = Date.now();
      execTimestampRef.current = ts;
      wsRef.current.send(JSON.stringify({ type: 'execution_result', output: out, error: err || '', user_name: user?.name || 'Peer', timestamp: ts }));
    }
  };

  const handleRun = async () => {
    if (language === 'web') { setPreviewRun(n => n + 1); return; }
    setIsRunning(true); setError(''); setOutput(''); setSqlResult(null);
    try {
      const res = await api.runCompiler(sessionId, code, language, USES_STDIN.has(language) ? stdin : '');
      setError(res.error || '');
      setOutput(res.output || '');
      if (res.sql) setSqlResult(res.sql);
      shareResult(res.sql ? sqlToText(res.sql) : (res.output || ''), res.error);
    } catch (err) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    const fresh = HELLO[language];
    setCode(fresh);
    draftsRef.current = { ...draftsRef.current, [language]: fresh };
    broadcast(fresh, language);
    setOutput(''); setError(''); setSqlResult(null);
  };

  return (
    <div className="flex-1 flex flex-col gap-3 p-3 sm:p-4 h-full bg-paper overflow-hidden min-h-0 min-w-0">
      <div className="flex-1 flex flex-col min-h-0 bg-surface rounded-xl border border-line shadow-elev-1 overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="bg-lift border-b border-line px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Language"
              value={language}
              onChange={e => switchLanguage(e.target.value)}
              className="text-xs font-bold bg-surface border border-line rounded px-2 py-1"
            >
              {LANGS.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}
            </select>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-clay bg-lift px-2 py-1 rounded border border-line whitespace-nowrap shrink-0">
              <span>{syncStatus}</span>
              {saveStatus && <span className="border-l border-line pl-1.5 text-brandInk">{saveStatus}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {remoteRunIndicator && (
              <span className="text-[10px] text-brandInk bg-brand/10 px-2 py-1 rounded animate-pulse whitespace-nowrap shrink-0">{remoteRunIndicator}</span>
            )}
            {USES_STDIN.has(language) && (
              <button type="button" onClick={() => setShowInput(v => !v)} aria-pressed={showInput}
                className="text-clay hover:text-ink px-2.5 py-1.5 text-xs font-semibold rounded hover:bg-lift shrink-0">
                {showInput ? 'Hide input' : 'Input'}
              </button>
            )}
            <button onClick={handleRun} disabled={isRunning || !code.trim()} title="Run (Ctrl + Enter)"
              className="btn-primary text-xs px-3 py-1.5 h-auto min-h-0 whitespace-nowrap shrink-0">
              {language === 'web' ? 'Refresh preview' : isRunning ? 'Running...' : 'Run ▶'}
            </button>
            <button onClick={() => { setOutput(''); setError(''); setSqlResult(null); }}
              className="text-clay hover:text-ink px-2.5 py-1.5 text-xs font-semibold transition-colors rounded hover:bg-lift shrink-0">Clear</button>
            <button onClick={handleReset}
              className="text-red-400 hover:text-red-300 px-2.5 py-1.5 text-xs font-semibold transition-colors rounded hover:bg-red-500/10 shrink-0">Reset</button>
          </div>
        </div>

        {language === 'web' ? (
          <div className="flex-1 grid gap-2 p-2 min-h-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', overflow: 'auto' }}>
            <div className="flex flex-col min-h-0 border border-line rounded-lg overflow-hidden">
              <div className="flex gap-1 p-1 bg-lift border-b border-line" role="tablist" aria-label="Web files">
                {['html', 'css', 'js'].map(t => (
                  <button key={t} type="button" role="tab" aria-selected={webTab === t} onClick={() => setWebTab(t)}
                    className={`text-xs font-bold px-3 py-1 rounded ${webTab === t ? 'bg-surface border border-line' : 'text-clay'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <LazyCodeEditor
                key={webTab}
                height={300}
                language={webTab === 'js' ? 'javascript' : webTab}
                value={web[webTab]}
                onChange={v => setWebPart(webTab, v)}
                onRun={handleRun}
                ariaLabel={`${webTab.toUpperCase()} editor`}
              />
            </div>
            <WebPreview html={web.html} css={web.css} js={web.js} runKey={previewRun} height={260} />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <LazyCodeEditor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onRun={handleRun}
              ariaLabel={`${LANGUAGE_LABELS[language]} editor`}
            />
          </div>
        )}
      </div>

      {showInput && USES_STDIN.has(language) && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden shrink-0">
          <div className="bg-lift border-b border-line px-3 py-1 text-xs font-bold text-clay">Input (what the program reads with input() / Scanner / stdin)</div>
          <textarea value={stdin} onChange={e => setStdin(e.target.value)} rows={3} spellCheck="false"
            className="w-full p-2 font-mono text-xs bg-paper focus:outline-none resize-y" placeholder="Type the input here, one value per line" />
        </div>
      )}

      {language !== 'web' && (
        <div className="h-32 sm:h-40 md:h-44 flex flex-col bg-surface rounded-xl border border-line shadow-elev-1 overflow-hidden shrink-0 min-w-0">
          <div className="bg-ink/5 border-b border-line px-3 sm:px-4 py-1.5 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-ink/60">Output</span>
            {isRunning && <span className="text-[10px] text-moss font-semibold animate-pulse">Running...</span>}
          </div>
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto font-mono text-xs sm:text-sm whitespace-pre-wrap break-words min-h-0" style={{ background: sqlResult ? '#1F1C17' : undefined, color: sqlResult ? '#D6F3EA' : undefined }}>
            {isRunning && !error && !output && <span className="text-ink/40 italic">Executing code...</span>}
            {error && (
              <div className="text-red-600 break-words">
                <span className="font-semibold text-[10px] uppercase tracking-wider text-red-500/70 block mb-1">Error</span>
                {error}
              </div>
            )}
            {sqlResult ? <SqlTable results={sqlResult} /> : output ? (
              <div className="text-ink break-words">{output}</div>
            ) : !error && !isRunning ? (
              <span className="text-ink/30 italic text-xs">Run your code to see output here. Tip: Ctrl + Enter runs it.</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
