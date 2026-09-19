import { useMemo } from 'react';

export default function SkillVerseBackground() {
  // Seeded constellation nodes — stable across renders
  const nodes = useMemo(() => {
    const seed = [
      { x: 8,  y: 12, s: 3,   o: 0.30, d: 0   },
      { x: 22, y: 5,  s: 2.5, o: 0.20, d: 1.2 },
      { x: 38, y: 18, s: 4,   o: 0.35, d: 2.8 },
      { x: 55, y: 8,  s: 2,   o: 0.18, d: 0.5 },
      { x: 72, y: 22, s: 3.5, o: 0.28, d: 3.5 },
      { x: 88, y: 10, s: 2.5, o: 0.22, d: 1.8 },
      { x: 15, y: 38, s: 2,   o: 0.15, d: 4.2 },
      { x: 45, y: 45, s: 5,   o: 0.30, d: 0.8 },
      { x: 68, y: 55, s: 3,   o: 0.25, d: 2.2 },
      { x: 92, y: 40, s: 2,   o: 0.18, d: 3.8 },
      { x: 30, y: 65, s: 3,   o: 0.20, d: 1.5 },
      { x: 58, y: 72, s: 2.5, o: 0.22, d: 4.5 },
      { x: 78, y: 80, s: 4,   o: 0.28, d: 0.3 },
      { x: 12, y: 82, s: 2,   o: 0.15, d: 2.5 },
      { x: 42, y: 88, s: 3,   o: 0.20, d: 3.0 },
      { x: 85, y: 92, s: 2.5, o: 0.18, d: 1.0 },
      { x: 62, y: 28, s: 2,   o: 0.16, d: 5.0 },
      { x: 25, y: 52, s: 3.5, o: 0.25, d: 2.0 },
      { x: 95, y: 65, s: 2,   o: 0.14, d: 4.0 },
      { x: 50, y: 32, s: 2.5, o: 0.22, d: 1.3 },
    ];
    return seed.map((n, i) => ({ ...n, id: i }));
  }, []);

  // Sparse edge set for constellation lines
  const edges = useMemo(() => [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
    [0, 6], [6, 7], [7, 8], [8, 9],
    [2, 16], [16, 7], [7, 17], [17, 10],
    [10, 11], [11, 12], [12, 15],
    [13, 14], [14, 11],
    [4, 8], [17, 18], [19, 7],
  ], []);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-paper">

      {/*
        LAYER 1: Soft ivory-lavender atmospheric base
      */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,_rgba(236,238,255,0.7)_0%,_rgba(252,251,249,0.95)_60%,_rgba(244,244,250,0.8)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,_rgba(6,182,212,0.04)_0%,_transparent_70%)]" />

      {/*
        LAYER 2: Knowledge constellation — nodes + edges
      */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgb(67,56,202)"  stopOpacity="0.18" />
            <stop offset="50%"  stopColor="rgb(124,58,237)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="rgb(6,182,212)"  stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="pathArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgb(67,56,202)"  stopOpacity="0.06" />
            <stop offset="100%" stopColor="rgb(245,158,11)"  stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Constellation edges */}
        {edges.map(([a, b]) => {
          const na = nodes[a], nb = nodes[b];
          if (!na || !nb) return null;
          return (
            <line
              key={`e-${a}-${b}`}
              x1={`${na.x}%`} y1={`${na.y}%`}
              x2={`${nb.x}%`} y2={`${nb.y}%`}
              stroke="url(#edgeGrad)"
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}

        {/* Constellation nodes */}
        {nodes.map(n => (
          <g key={n.id} className="animate-slow-pulse" style={{ animationDelay: `${n.d}s` }}>
            <circle
              cx={`${n.x}%`} cy={`${n.y}%`} r={n.s}
              fill="rgb(67,56,202)" opacity={n.o}
            />
          </g>
        ))}

        {/*
          LAYER 3: Subtle abstract learning-world symbols
          Rendered at very low opacity so they're perceived subconsciously.
          Positioned away from the typical content area (top-right, bottom-left corners).
        */}

        {/* Code brackets — top-right corner */}
        <g opacity="0.055" transform="translate(78%, 6%)">
          <text fontFamily="'JetBrains Mono', monospace" fontSize="42" fill="rgb(67,56,202)" fontWeight="400">&lt;/&gt;</text>
        </g>

        {/* Orbit ring — bottom-left area */}
        <g opacity="0.06" transform="translate(5%, 70%)">
          <ellipse cx="60" cy="30" rx="55" ry="22" stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" strokeDasharray="4 6" />
          <circle cx="115" cy="30" r="5" fill="rgb(67,56,202)" opacity="0.5" />
        </g>

        {/* Node-link diagram — right side mid */}
        <g opacity="0.05" transform="translate(88%, 42%)">
          <circle cx="0"   cy="0"   r="6" fill="rgb(124,58,237)" />
          <circle cx="40"  cy="-20" r="5" fill="rgb(67,56,202)" />
          <circle cx="40"  cy="20"  r="4" fill="rgb(6,182,212)" />
          <line x1="0" y1="0" x2="40" y2="-20" stroke="rgb(124,58,237)" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="40" y2="20"  stroke="rgb(67,56,202)"  strokeWidth="1.5" />
        </g>

        {/* Infinity / continuous learning — top area center */}
        <g opacity="0.04" transform="translate(44%, 2%)">
          <path d="M 0 20 C 0 8 15 8 20 20 C 25 32 40 32 40 20 C 40 8 25 8 20 20 C 15 32 0 32 0 20 Z"
                stroke="rgb(67,56,202)" strokeWidth="2" fill="none" />
        </g>

        {/* Compass rose — lower right */}
        <g opacity="0.04" transform="translate(90%, 78%)">
          <circle cx="20" cy="20" r="18" stroke="rgb(245,158,11)" strokeWidth="1.5" fill="none" strokeDasharray="3 5" />
          <line x1="20" y1="2"  x2="20" y2="38" stroke="rgb(245,158,11)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2"  y1="20" x2="38" y2="20" stroke="rgb(245,158,11)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="20" r="3" fill="rgb(245,158,11)" />
        </g>

        {/* Arrow path — suggesting direction/journey */}
        <g opacity="0.05" transform="translate(3%, 15%)">
          <path d="M 0 0 C 20 30 10 60 30 80" stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="3 7" />
          <polygon points="25,76 30,88 35,76" fill="rgb(67,56,202)" opacity="0.4" />
        </g>

        {/*
          LAYER 4: Broad directional flow arc
          A single sweeping curve giving the page a sense of direction and journey.
        */}
        <path
          d="M -5% 95% C 25% 50% 75% 45% 105% 5%"
          stroke="url(#pathArcGrad)"
          strokeWidth="80"
          fill="none"
          opacity="0.35"
        />

      </svg>

      {/*
        LAYER 5: Slow orbital ambient blobs for depth
      */}
      <div className="absolute top-[-8%] left-[-8%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full bg-brandLight/50 blur-[140px] animate-ambient-drift-1 mix-blend-multiply opacity-60" />
      <div className="absolute bottom-[-12%] right-[-8%] w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full bg-lift blur-[170px] animate-ambient-drift-2 mix-blend-multiply opacity-55" />
      <div className="absolute top-[35%] right-[18%] w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] rounded-full bg-accent/4 blur-[110px] animate-ambient-drift-3 mix-blend-multiply opacity-45" />

      {/*
        LAYER 6: Blueprint dot grid — structured learning atmosphere
        Reduced opacity to let layers below breathe through
      */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(rgb(var(--color-brand)) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 80%)',
        }}
      />

      {/*
        LAYER 7: Very subtle paper noise for tactile depth
      */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")' }}
      />

    </div>
  );
}
