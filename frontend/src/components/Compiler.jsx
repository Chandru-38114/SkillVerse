import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const DEFAULT_CODE = 'print("Hello, SkillVerse!")\n';

export default function Compiler({ sessionId }) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState('🟡 Connecting...');
  const [saveStatus, setSaveStatus] = useState('');
  const wsRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  const versionRef = useRef(0);

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

    ws.onopen = () => setSyncStatus('🟢 Connected');
    ws.onclose = () => setSyncStatus('🔴 Disconnected');
    ws.onerror = () => setSyncStatus('🔴 Error');

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
      if (res.error) {
        setError(res.error);
      }
      setOutput(res.output || '');
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
    <div className="flex-1 flex flex-col p-4 gap-4 h-full bg-[#FDFDFC]">
      
      {/* Code Editor Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-line shadow-sm overflow-hidden">
        <div className="bg-ink/5 border-b border-line px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-ink/70">Python 3</span>
            <div className="flex items-center gap-2 text-xs font-medium text-ink/60 bg-white px-2 py-1 rounded shadow-sm border border-line">
              <span>{syncStatus}</span>
              {saveStatus && <span className="border-l border-line pl-2 text-moss">{saveStatus}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRun}
              disabled={isRunning || !code.trim()}
              className="bg-moss text-white px-4 py-1 rounded text-sm font-medium hover:bg-moss/90 disabled:opacity-50 transition-colors"
            >
              {isRunning ? 'Running...' : 'Run Code'}
            </button>
            <button 
              onClick={handleClear}
              className="text-ink/60 hover:text-ink px-3 py-1 text-sm font-medium transition-colors"
            >
              Clear
            </button>
            <button 
              onClick={handleReset}
              className="text-red-500/80 hover:text-red-600 px-3 py-1 text-sm font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
        
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 w-full p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none bg-[#1e1e1e] text-[#d4d4d4]"
          spellCheck="false"
          placeholder="Write your Python code here..."
        />
      </div>

      {/* Output Area */}
      <div className="h-1/3 min-h-[200px] flex flex-col bg-white rounded-xl border border-line shadow-sm overflow-hidden">
        <div className="bg-ink/5 border-b border-line px-4 py-2">
          <span className="text-sm font-semibold text-ink/70">Output</span>
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-sm bg-paper whitespace-pre-wrap">
          {error && (
            <div className="text-red-600 break-words mb-2">{error}</div>
          )}
          {output ? (
            <div className="text-ink break-words">{output}</div>
          ) : !error ? (
            <span className="text-ink/30 italic">No output...</span>
          ) : null}
        </div>
      </div>

    </div>
  );
}
