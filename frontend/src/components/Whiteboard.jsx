import { MousePointer2, Move, Pencil, Minus, ArrowRight, Square, Circle, Diamond, Type, Eraser, Undo, Redo, Trash2 } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { api, getSessionUser } from '../api';
import { SessionWebSocketContext } from './VideoChat';

export default function Whiteboard({ sessionId }) {
  const svgRef = useRef(null);
  
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  const [tool, setTool] = useState('pencil');
  const [action, setAction] = useState('none');
  const [selectedId, setSelectedId] = useState(null);

  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [dragStart, setDragStart] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);

  const [textInput, setTextInput] = useState({ x: 0, y: 0, value: '' });
  const textInputRef = useRef(null);

  // Status and Sync
  const [syncStatus, setSyncStatus] = useState('🟢 Connected'); // 🟢 Connected, 🔴 Disconnected
  const [saveStatus, setSaveStatus] = useState(''); // Saving..., Saved, Save failed
  const wsRef = useRef(null);
  const sharedWs = useContext(SessionWebSocketContext);
  const isRemoteUpdate = useRef(false);

  // Fetch initial board state
  useEffect(() => {
    async function loadBoard() {
      try {
        const res = await api.getWhiteboard(sessionId);
        if (res.state) {
          const parsed = JSON.parse(res.state);
          isRemoteUpdate.current = true;
          setElements(parsed);
          setHistory([parsed]);
          setHistoryStep(0);
        }
      } catch (err) {
        console.error("Failed to load whiteboard", err);
      }
    }
    loadBoard();
  }, [sessionId]);

  // WebSocket Connection using shared socket
  useEffect(() => {
    if (!sharedWs) {
      setSyncStatus('🔴 Disconnected');
      return;
    }
    
    wsRef.current = sharedWs;
    setSyncStatus(sharedWs.readyState === WebSocket.OPEN ? '🟢 Connected' : '🟡 Connecting...');
    
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update_elements') {
          isRemoteUpdate.current = true;
          setElements(msg.elements);
          // Also update history so we don't overwrite remote changes
          setHistory(prev => {
            const newHist = [...prev, msg.elements];
            setHistoryStep(newHist.length - 1);
            return newHist;
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    sharedWs.addEventListener('message', handleMessage);
    
    return () => {
      sharedWs.removeEventListener('message', handleMessage);
    };
  }, [sharedWs]);

  // Debounced Auto-Save
  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return; // don't save remote updates immediately, they'll be saved by the other peer or on next local action
    }

    const stateStr = JSON.stringify(elements);

    // Debounce save
    setSaveStatus('Saving...');
    const timer = setTimeout(async () => {
      try {
        await api.saveWhiteboard(sessionId, stateStr);
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        setSaveStatus('Save failed');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [elements, sessionId]);

  const broadcastElements = (newElements) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_elements', elements: newElements }));
    }
  };

  const commitElements = useCallback((newElements) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    setElements(newElements);
    broadcastElements(newElements);
  }, [history, historyStep]);

  const handleUndo = useCallback(() => {
    if (historyStep > 0) {
      const prev = history[historyStep - 1];
      setHistoryStep(historyStep - 1);
      setElements(prev);
      setSelectedId(null);
      broadcastElements(prev);
    }
  }, [history, historyStep]);

  const handleRedo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const next = history[historyStep + 1];
      setHistoryStep(historyStep + 1);
      setElements(next);
      setSelectedId(null);
      broadcastElements(next);
    }
  }, [history, historyStep]);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire whiteboard?')) {
      commitElements([]);
      setSelectedId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (action === 'editing_text') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setAction('none');
        setSelectedId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        commitElements(elements.filter(el => el.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, selectedId, elements, history, historyStep, handleUndo, handleRedo, commitElements]);

  const getCanvasCoords = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    // For touch support
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  const handleCommitText = () => {
    if (textInput.value.trim()) {
      const newEl = {
        id: Date.now().toString(),
        type: 'text',
        x1: textInput.x, y1: textInput.y,
        x2: textInput.x, y2: textInput.y,
        text: textInput.value,
        strokeColor, strokeWidth
      };
      commitElements([...elements, newEl]);
    }
    setAction('none');
  };

  const handlePointerDown = (e) => {
    if (action === 'editing_text') {
      // If clicking on SVG while editing text, commit the text.
      handleCommitText();
      return;
    }

    if (e.button === 1 || tool === 'pan' || (e.button === 0 && e.altKey)) {
      setAction('panning');
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPanStart({ x: clientX, y: clientY });
      return;
    }

    if (tool === 'select' || tool === 'eraser') {
      setSelectedId(null);
      return;
    }

    const { x, y } = getCanvasCoords(e);

    if (tool === 'text') {
      setAction('editing_text');
      setTextInput({ x, y, value: '' });
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

    setAction('drawing');
    const newEl = {
      id: Date.now().toString(),
      type: tool,
      x1: x, y1: y, x2: x, y2: y,
      points: [{ x, y }],
      strokeColor, strokeWidth
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const handlePointerMove = (e) => {
    if (action === 'panning' && panStart) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - panStart.x;
      const dy = clientY - panStart.y;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      setPanStart({ x: clientX, y: clientY });
      return;
    }

    if (action === 'drawing') {
      const { x, y } = getCanvasCoords(e);
      const newElements = [...elements];
      const current = newElements[newElements.length - 1];
      if (current.type === 'pencil') {
        current.points.push({ x, y });
      } else {
        current.x2 = x;
        current.y2 = y;
      }
      setElements(newElements);
    } else if (action === 'moving' && dragStart) {
      const { x, y } = getCanvasCoords(e);
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      const newElements = elements.map(el => {
        if (el.id === selectedId) {
          if (el.type === 'pencil') {
            return { ...el, points: dragStart.original.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          } else {
            return {
              ...el,
              x1: dragStart.original.x1 + dx,
              y1: dragStart.original.y1 + dy,
              x2: dragStart.original.x2 + dx,
              y2: dragStart.original.y2 + dy,
            };
          }
        }
        return el;
      });
      setElements(newElements);
    } else if (action === 'resizing' && dragStart) {
      const { x, y } = getCanvasCoords(e);
      const newElements = elements.map(el => {
        if (el.id === selectedId) {
          let newX1 = el.x1, newY1 = el.y1, newX2 = el.x2, newY2 = el.y2;
          if (resizeHandle === 'tl') { newX1 = x; newY1 = y; }
          else if (resizeHandle === 'tr') { newX2 = x; newY1 = y; }
          else if (resizeHandle === 'bl') { newX1 = x; newY2 = y; }
          else if (resizeHandle === 'br') { newX2 = x; newY2 = y; }
          return { ...el, x1: newX1, y1: newY1, x2: newX2, y2: newY2 };
        }
        return el;
      });
      setElements(newElements);
    }
  };

  const handlePointerUp = () => {
    if (action === 'drawing' || action === 'moving' || action === 'resizing') {
      commitElements(elements);
    }
    if (action !== 'editing_text') {
      setAction('none');
      setDragStart(null);
      setPanStart(null);
      setResizeHandle(null);
    }
  };

  const handleElementPointerDown = (e, el) => {
    if (tool === 'eraser') {
      e.stopPropagation();
      commitElements(elements.filter(x => x.id !== el.id));
      setSelectedId(null);
      return;
    }
    if (tool === 'select') {
      e.stopPropagation();
      setSelectedId(el.id);
      setAction('moving');
      const { x, y } = getCanvasCoords(e);
      setDragStart({ x, y, original: JSON.parse(JSON.stringify(el)) });
    }
  };

  const handleResizeDown = (e, el, handle) => {
    e.stopPropagation();
    setAction('resizing');
    setResizeHandle(handle);
    const { x, y } = getCanvasCoords(e);
    setDragStart({ x, y, original: JSON.parse(JSON.stringify(el)) });
  };

  const renderElement = (el) => {
    const isSelected = el.id === selectedId;
    const isInteractive = tool === 'select' || tool === 'eraser';
    const cursor = tool === 'eraser' ? 'crosshair' : 'move';
    const baseStyle = { pointerEvents: isInteractive ? 'stroke' : 'none', cursor };
    const fillStyle = { pointerEvents: isInteractive ? 'fill' : 'none', cursor };
    
    let shape = null;
    let hitArea = null; // Thick invisible stroke for easier eraser/selection
    
    const minX = Math.min(el.x1, el.x2);
    const maxX = Math.max(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const maxY = Math.max(el.y1, el.y2);
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);

    if (el.type === 'pencil') {
      const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      shape = <path d={d} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" style={baseStyle} />;
      hitArea = <path d={d} stroke="transparent" strokeWidth={15} fill="none" style={baseStyle} />;
    } else if (el.type === 'line') {
      shape = <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.strokeColor} strokeWidth={el.strokeWidth} style={baseStyle} />;
      hitArea = <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth={15} style={baseStyle} />;
    } else if (el.type === 'arrow') {
      const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const headlen = 15;
      const ax1 = el.x2 - headlen * Math.cos(angle - Math.PI / 6);
      const ay1 = el.y2 - headlen * Math.sin(angle - Math.PI / 6);
      const ax2 = el.x2 - headlen * Math.cos(angle + Math.PI / 6);
      const ay2 = el.y2 - headlen * Math.sin(angle + Math.PI / 6);
      shape = (
        <g style={baseStyle}>
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.strokeColor} strokeWidth={el.strokeWidth} />
          <polyline points={`${ax1},${ay1} ${el.x2},${el.y2} ${ax2},${ay2}`} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="none" />
        </g>
      );
      hitArea = <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth={15} style={baseStyle} />;
    } else if (el.type === 'rectangle') {
      shape = <rect x={minX} y={minY} width={w} height={h} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="transparent" style={fillStyle} />;
    } else if (el.type === 'ellipse') {
      shape = <ellipse cx={minX + w/2} cy={minY + h/2} rx={w/2} ry={h/2} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="transparent" style={fillStyle} />;
    } else if (el.type === 'diamond') {
      const cx = minX + w/2; const cy = minY + h/2;
      const pts = `${cx},${minY} ${maxX},${cy} ${cx},${maxY} ${minX},${cy}`;
      shape = <polygon points={pts} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fill="transparent" style={fillStyle} />;
    } else if (el.type === 'text') {
      const lines = el.text.split('\n');
      const fontSize = el.strokeWidth * 8 + 12;
      shape = (
        <text x={el.x1} y={el.y1} fill={el.strokeColor} fontSize={fontSize} fontFamily="sans-serif" style={{...fillStyle, userSelect: 'none'}}>
          {lines.map((line, i) => (
            <tspan key={i} x={el.x1} dy={i === 0 ? 0 : fontSize * 1.2}>{line}</tspan>
          ))}
        </text>
      );
    }

    return (
      <g key={el.id} onPointerDown={(e) => handleElementPointerDown(e, el)}>
        {hitArea}
        {shape}
        {isSelected && tool === 'select' && el.type !== 'pencil' && el.type !== 'text' && (el.type === 'line' || el.type === 'arrow') && (
          <>
            <circle cx={el.x1} cy={el.y1} r={6} fill="white" stroke="#0d9488" strokeWidth={2} onPointerDown={(e) => handleResizeDown(e, el, 'tl')} style={{cursor: 'pointer'}} />
            <circle cx={el.x2} cy={el.y2} r={6} fill="white" stroke="#0d9488" strokeWidth={2} onPointerDown={(e) => handleResizeDown(e, el, 'br')} style={{cursor: 'pointer'}} />
          </>
        )}
        {isSelected && tool === 'select' && el.type !== 'pencil' && el.type !== 'text' && el.type !== 'line' && el.type !== 'arrow' && (
          <>
            <circle cx={el.x1} cy={el.y1} r={6} fill="white" stroke="#0d9488" strokeWidth={2} onPointerDown={(e) => handleResizeDown(e, el, 'tl')} style={{cursor: 'nwse-resize'}} />
            <circle cx={el.x2} cy={el.y1} r={6} fill="white" stroke="#0d9488" strokeWidth={2} onPointerDown={(e) => handleResizeDown(e, el, 'tr')} style={{cursor: 'nesw-resize'}} />
            <circle cx={el.x1} cy={el.y2} r={6} fill="white" stroke="#0d9488" strokeWidth={2} onPointerDown={(e) => handleResizeDown(e, el, 'bl')} style={{cursor: 'nesw-resize'}} />
            <circle cx={el.x2} cy={el.y2} r={6} fill="white" stroke="#0d9488" strokeWidth={2} onPointerDown={(e) => handleResizeDown(e, el, 'br')} style={{cursor: 'nwse-resize'}} />
          </>
        )}
        {isSelected && tool === 'select' && (
          <rect x={minX - 5} y={minY - 5} width={w + 10} height={h + 10} fill="none" stroke="#0d9488" strokeWidth={1} strokeDasharray="4" style={{pointerEvents: 'none'}} />
        )}
      </g>
    );
  };

  const toolbarTools = [
    { id: 'select', icon: <MousePointer2 className="w-5 h-5" />, label: 'Select' },
    { id: 'pan', icon: <Move className="w-5 h-5" />, label: 'Pan' },
    { id: 'pencil', icon: <Pencil className="w-5 h-5" />, label: 'Draw' },
    { id: 'line', icon: <Minus className="w-5 h-5" />, label: 'Line' },
    { id: 'arrow', icon: <ArrowRight className="w-5 h-5" />, label: 'Arrow' },
    { id: 'rectangle', icon: <Square className="w-5 h-5" />, label: 'Rect' },
    { id: 'ellipse', icon: <Circle className="w-5 h-5" />, label: 'Ellipse' },
    { id: 'diamond', icon: <Diamond className="w-5 h-5" />, label: 'Diamond' },
    { id: 'text', icon: <Type className="w-5 h-5" />, label: 'Text' },
    { id: 'eraser', icon: <Eraser className="w-5 h-5" />, label: 'Eraser' },
  ];
  const colors = ['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const widths = [2, 4, 8];

  return (
    <div className="flex-1 flex flex-col bg-paper relative overflow-hidden h-full">
      {/* Top Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface shadow-elev-1 rounded-xl shadow-md border border-line p-2 flex items-center gap-1 z-10 overflow-x-auto max-w-[95%]">
        {toolbarTools.map(t => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); setSelectedId(null); }}
            title={t.label}
            className={`w-9 h-9 shrink-0 rounded flex items-center justify-center text-lg transition-colors ${tool === t.id ? 'bg-moss/10 text-moss' : 'hover:bg-ink/5'}`}
          >
            {t.icon}
          </button>
        ))}
        <div className="w-px h-6 bg-line mx-2 shrink-0" />
        <button onClick={handleUndo} disabled={historyStep === 0} title="Undo" className="w-9 h-9 shrink-0 rounded flex items-center justify-center hover:bg-ink/5 disabled:opacity-30"><Undo className="w-5 h-5" /></button>
        <button onClick={handleRedo} disabled={historyStep === history.length - 1} title="Redo" className="w-9 h-9 shrink-0 rounded flex items-center justify-center hover:bg-ink/5 disabled:opacity-30"><Redo className="w-5 h-5" /></button>
        <div className="w-px h-6 bg-line mx-2 shrink-0" />
        <button onClick={handleClear} title="Clear Board" className="w-9 h-9 shrink-0 rounded flex items-center justify-center hover:bg-red-50 text-red-500"><Trash2 className="w-5 h-5" /></button>
      </div>

      {/* Side Options Panel */}
      <div className="absolute top-20 left-4 bg-surface shadow-elev-1 rounded-xl shadow-md border border-line p-3 flex flex-col gap-4 z-10 w-12 hidden sm:flex">
        <div className="flex flex-col gap-2">
          {colors.map(c => (
            <button key={c} onClick={() => setStrokeColor(c)} className={`w-6 h-6 rounded-full border-2 mx-auto ${strokeColor === c ? 'border-ink' : 'border-transparent'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="w-full h-px bg-line" />
        <div className="flex flex-col gap-2 items-center">
          {widths.map(w => (
            <button key={w} onClick={() => setStrokeWidth(w)} className={`w-8 h-8 rounded flex items-center justify-center ${strokeWidth === w ? 'bg-ink/10' : 'hover:bg-ink/5'}`}>
              <div className="bg-ink rounded-full" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Zoom Controls & Status */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        <div className="bg-surface/90 shadow-elev-1 rounded-xl shadow border border-line px-3 py-1 flex items-center text-xs font-medium text-ink/70">
          {syncStatus}
          {saveStatus && <span className="ml-2 pl-2 border-l border-line text-moss">{saveStatus}</span>}
        </div>
        <div className="bg-surface shadow-elev-1 rounded-xl shadow-md border border-line p-1 flex items-center w-max">
          <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="w-8 h-8 rounded hover:bg-ink/5 font-bold">-</button>
          <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="w-8 h-8 rounded hover:bg-ink/5 font-bold">+</button>
          <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="px-2 h-8 rounded hover:bg-ink/5 text-xs font-medium border-l border-line ml-1">Reset</button>
        </div>
      </div>

      {/* Main Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-crosshair touch-none"
        style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x % 40}, ${pan.y % 40}) scale(${zoom})`}>
            <circle cx="2" cy="2" r="1" fill="#e5e7eb" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {elements.map(renderElement)}
          
          {action === 'editing_text' && (
            <foreignObject x={textInput.x} y={textInput.y} width="1000" height="500" style={{ overflow: 'visible' }}>
              <textarea
                ref={textInputRef}
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onBlur={handleCommitText}
                style={{
                  background: 'transparent',
                  border: '1px dashed #0d9488',
                  outline: 'none',
                  color: strokeColor,
                  fontSize: strokeWidth * 8 + 12,
                  fontFamily: 'sans-serif',
                  minWidth: '50px',
                  minHeight: '1.5em',
                  resize: 'none',
                  overflow: 'visible',
                  whiteSpace: 'pre',
                  lineHeight: '1.2'
                }}
              />
            </foreignObject>
          )}
        </g>
      </svg>
    </div>
  );
}
