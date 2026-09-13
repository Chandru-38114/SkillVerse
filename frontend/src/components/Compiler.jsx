import { useState, useRef, useEffect } from 'react';
import { api, getSessionUser } from '../api';

const DEFAULT_CODE = 'print("Hello, SkillVerse!")\n';

export default function Compiler({ sessionId }) {
  const user = getSessionUser();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState('dYY Connecting...');
  const [saveStatus, setSaveStatus] = useState('');
  const wsRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  // Indicator for when remote user runs code
  const [remoteRunIndicator, setRemoteRunIndicator] = useState(null);

  const versionRef = useRef(0);
  const execTimestampRef = useRef(0);

  // 1. Initial Load
  useEffect(() => {
    async function loadCompiler() {
      try {
        const res = await api.getCompilerState(sessionId);
        if (res.code) {
          isRemoteUpdate.current = true;
          versionRef.current = res.version || 0;
          setCode(res.code);
        }
      } catch (err) {
        console.error("Failed to load compiler state", err);
      }
    }
    loadCompiler();
  }, [sessionId]);

  // 2. WebSocket Connection
  useEffect(() => {
    const token = localStorage.getItem("skillverse_token");
    if (!token) return;

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/compiler/${sessionId}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setSyncStatus('Connected');
    ws.onclose = () => setSyncStatus('Disconnected');
    ws.onerror = () => setSyncStatus('Error');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update_code') {
          if (msg.version && msg.version <= versionRef.current) {
            return; // ignore stale version
          }
          versionRef.current = msg.version;
          isRemoteUpdate.current = true;
          setCode(msg.code);
        } else if (msg.type === 'execution_result') {
          if (msg.timestamp && msg.timestamp <= execTimestampRef.current) {
            return; // ignore stale execution
          }
          execTimestampRef.current = msg.timestamp || Date.now();
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

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId]);

  // 3. Debounced Sync & Save via WebSocket
  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    setSaveStatus('Saving...');
    const timer = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'update_code', code }));
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('Save failed (offline)');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [code, sessionId]);

  const handleRun = async () => {
    setIsRunning(true);
    setError('');
    setOutput('');
    
    try {
      const res = await api.runCompiler(sessionId, code);
      if (res.error) setError(res.error);
      const newOutput = res.output || '';
      setOutput(newOutput);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const ts = Date.now();
        execTimestampRef.current = ts;
        wsRef.current.send(JSON.stringify({ 
          type: 'execution_result', 
          output: newOutput,
          error: res.error || '',
          user_name: user?.name || 'Peer',
          timestamp: ts
        }));
      }
    } catch (err) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setOutput('');
    setError('');
  };

  const handleReset = () => {
    setCode(DEFAULT_CODE);
    handleClear();
  };

  // Simple handler to support "Tab" key in textarea
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      // Wait for React to update the state before setting cursor
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 4;
      }, 0);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 p-3 sm:p-4 h-full bg-[#FDFDFC] overflow-hidden min-h-0 min-w-0">

      {/* Code Editor Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-line shadow-sm overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="bg-ink/5 border-b border-line px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-ink/60 whitespace-nowrap">Python 3</span>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-ink/50 bg-white px-2 py-1 rounded border border-line whitespace-nowrap shrink-0">
              <span>{syncStatus}</span>
              {saveStatus && <span className="border-l border-line pl-1.5 text-moss">{saveStatus}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {remoteRunIndicator && (
              <span className="text-[10px] text-moss bg-moss/10 px-2 py-1 rounded animate-pulse whitespace-nowrap shrink-0">
                {remoteRunIndicator}
              </span>
            )}
            <button
              onClick={handleRun}
              disabled={isRunning || !code.trim()}
              className="bg-moss text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-moss/90 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
            <button
              onClick={handleClear}
              className="text-ink/50 hover:text-ink px-2.5 py-1.5 text-xs font-semibold transition-colors rounded hover:bg-ink/5 shrink-0"
            >
              Clear
            </button>
            <button
              onClick={handleReset}
              className="text-red-500/70 hover:text-red-600 px-2.5 py-1.5 text-xs font-semibold transition-colors rounded hover:bg-red-50 shrink-0"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Code textarea ?" horizontally scrollable inside, not the whole page */}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 w-full p-3 sm:p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none bg-[#1e1e1e] text-[#d4d4d4] min-h-[120px]"
          spellCheck="false"
          placeholder="Write your Python code here..."
          style={{ overflowX: 'auto', wordBreak: 'keep-all', whiteSpace: 'pre' }}
        />
      </div>

      {/* Output Area ?" fixed sensible height on mobile */}
      <div className="h-32 sm:h-40 md:h-44 flex flex-col bg-white rounded-xl border border-line shadow-sm overflow-hidden shrink-0 min-w-0">
        <div className="bg-ink/5 border-b border-line px-3 sm:px-4 py-1.5 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-ink/60">Output</span>
          {isRunning && (
            <span className="text-[10px] text-moss font-semibold animate-pulse">Running...</span>
          )}
        </div>
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto font-mono text-xs sm:text-sm bg-paper whitespace-pre-wrap break-words min-h-0">
          {isRunning && !error && !output && (
            <span className="text-ink/40 italic">Executing code...</span>
          )}
          {error && (
            <div className="text-red-600 break-words">
              <span className="font-semibold text-[10px] uppercase tracking-wider text-red-500/70 block mb-1">Error</span>
              {error}
            </div>
          )}
          {output ? (
            <div className="text-ink break-words">{output}</div>
          ) : !error && !isRunning ? (
            <span className="text-ink/30 italic text-xs">Run your code to see output here.</span>
          ) : null}
        </div>
      </div>

    </div>
  );
}
