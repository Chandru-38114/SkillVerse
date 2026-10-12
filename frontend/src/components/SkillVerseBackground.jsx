import { useMemo } from 'react';

/* ─── Colour constants (matching CSS vars exactly) ─── */
const C = {
  brand:  'rgb(67,56,202)',
  brand2: 'rgb(124,58,237)',
  accent: 'rgb(6,182,212)',
  gold:   'rgb(245,158,11)',
};

export default function SkillVerseBackground() {

  /* ─── 1. KNOWLEDGE GRAPH — stable positions ─── */
  const nodes = useMemo(() => [
    /* top-left cluster — discovery / compass zone */
    { x:  6, y:  9, r: 2.5, o: 0.28, d: 0   },
    { x: 18, y:  4, r: 2,   o: 0.20, d: 1.5 },
    { x: 32, y: 14, r: 3.5, o: 0.32, d: 3.0 },
    /* top-right cluster — technology zone */
    { x: 60, y:  7, r: 2,   o: 0.18, d: 0.7 },
    { x: 74, y: 16, r: 3,   o: 0.26, d: 2.3 },
    { x: 90, y:  8, r: 2,   o: 0.19, d: 4.0 },
    /* mid-left — learning paths */
    { x: 12, y: 40, r: 2,   o: 0.16, d: 5.0 },
    { x: 28, y: 52, r: 4,   o: 0.28, d: 1.0 },
    { x: 10, y: 62, r: 2.5, o: 0.22, d: 3.5 },
    /* mid — central knowledge hub */
    { x: 48, y: 38, r: 5,   o: 0.30, d: 0.4 },
    { x: 62, y: 48, r: 3,   o: 0.24, d: 2.8 },
    { x: 44, y: 60, r: 2.5, o: 0.20, d: 4.2 },
    /* right mid — collaboration zone */
    { x: 82, y: 44, r: 2,   o: 0.16, d: 1.8 },
    { x: 94, y: 55, r: 2.5, o: 0.19, d: 3.2 },
    /* lower-left — mastery zone */
    { x: 18, y: 76, r: 3,   o: 0.22, d: 2.0 },
    { x:  8, y: 88, r: 2,   o: 0.15, d: 4.5 },
    { x: 36, y: 82, r: 2.5, o: 0.20, d: 0.9 },
    /* lower-right — orbit/discovery zone */
    { x: 68, y: 72, r: 4,   o: 0.26, d: 1.4 },
    { x: 85, y: 80, r: 2.5, o: 0.20, d: 3.7 },
    { x: 94, y: 90, r: 2,   o: 0.14, d: 5.5 },
  ].map((n, i) => ({ ...n, id: i })), []);

  /* ─── 2. EDGES — sparse, intentional, non-crossing ─── */
  const edges = useMemo(() => [
    /* top cluster chains */
    [0,1],[1,2],[2,3],[3,4],[4,5],
    /* left column */
    [0,6],[6,7],[7,8],
    /* central web */
    [2,9],[9,10],[10,11],[7,9],[9,12],
    /* right connections */
    [4,10],[10,13],[12,13],
    /* lower web */
    [8,14],[14,15],[14,16],[16,17],[17,18],[18,19],
    [11,16],[13,17],
  ], []);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-paper">

      {/* ════════════════════════════════════════════════
          LAYER 1 — Atmospheric ivory-lavender base
          Two radial washes that tilt color across viewport
          ════════════════════════════════════════════════ */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_15%_0%,_rgba(236,238,255,0.65)_0%,_rgba(252,251,249,0.98)_55%,_rgba(252,251,249,1)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_35%_at_85%_100%,_rgba(6,182,212,0.045)_0%,_transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_28%_at_50%_50%,_rgba(124,58,237,0.025)_0%,_transparent_70%)]" />

      {/* ════════════════════════════════════════════════
          LAYER 2 — SVG World
          All knowledge graph, symbols, and path geometry
          ════════════════════════════════════════════════ */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          {/* Edge gradient */}
          <linearGradient id="svbEdge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgb(67,56,202)"  stopOpacity="0.20" />
            <stop offset="60%"  stopColor="rgb(124,58,237)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="rgb(6,182,212)"  stopOpacity="0.03" />
          </linearGradient>

          {/* Broad sweeping directional arc — the "learning river" */}
          <linearGradient id="svbRiver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgb(67,56,202)"  stopOpacity="0.055" />
            <stop offset="45%"  stopColor="rgb(124,58,237)" stopOpacity="0.035" />
            <stop offset="100%" stopColor="rgb(245,158,11)"  stopOpacity="0.015" />
          </linearGradient>

          {/* Circuit path gradient — used for tech symbol lines */}
          <linearGradient id="svbCircuit" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="rgb(67,56,202)"  stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(6,182,212)"  stopOpacity="0.04" />
          </linearGradient>

          {/* Glow filter for the central hub node */}
          <filter id="svbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── 2a. KNOWLEDGE GRAPH EDGES ── */}
        {edges.map(([a, b]) => {
          const na = nodes[a], nb = nodes[b];
          if (!na || !nb) return null;
          return (
            <line
              key={`svb-e-${a}-${b}`}
              x1={`${na.x}%`} y1={`${na.y}%`}
              x2={`${nb.x}%`} y2={`${nb.y}%`}
              stroke="url(#svbEdge)"
              strokeWidth="1"
              opacity="0.55"
            />
          );
        })}

        {/* ── 2b. KNOWLEDGE GRAPH NODES ── */}
        {nodes.map(n => (
          <g key={n.id} className="animate-slow-pulse" style={{ animationDelay: `${n.d}s` }}>
            {/* Outer glow halo on the central hub */}
            {n.id === 9 && (
              <circle cx={`${n.x}%`} cy={`${n.y}%`} r={n.r * 3.5}
                fill="rgb(67,56,202)" opacity="0.06" filter="url(#svbGlow)" />
            )}
            <circle
              cx={`${n.x}%`} cy={`${n.y}%`} r={n.r}
              fill={n.id === 9 ? C.brand2 : C.brand}
              opacity={n.o}
            />
          </g>
        ))}

        {/* ── 2c. THE LEARNING RIVER ──
            A single wide, sweeping bezier arc — the visual "backbone" of
            the world. Passes diagonally from top-left to bottom-right,
            giving the page a sense of journeying direction.
            Opacity kept very low so it's felt, not read.
        */}
        <path
          d="M -2 80 C 20 65 35 50 52 38 C 68 26 80 18 102 8"
          stroke="url(#svbRiver)"
          strokeWidth="100"
          fill="none"
          opacity="0.40"
        />

        {/* ── 2d. CIRCUIT-PATH LANGUAGE ──
            Horizontal + vertical segments with 90° turns,
            mimicking PCB traces — technology/coding identity.
            All at very low opacity (0.06–0.09).
        */}

        {/* Top-right circuit trace */}
        <g opacity="0.07" stroke="url(#svbCircuit)" strokeWidth="1.5" fill="none">
          <polyline points="62%,3% 72%,3% 72%,8% 78%,8% 78%,13%" />
          <circle cx="72%" cy="3%" r="2" fill="rgb(67,56,202)" opacity="0.3" />
          <circle cx="78%" cy="13%" r="2" fill="rgb(6,182,212)" opacity="0.25" />
        </g>

        {/* Left-side circuit trace */}
        <g opacity="0.06" stroke="url(#svbCircuit)" strokeWidth="1.5" fill="none">
          <polyline points="3%,36% 3%,44% 10%,44% 10%,50% 16%,50%" />
          <circle cx="3%" cy="36%" r="2" fill="rgb(67,56,202)" opacity="0.25" />
          <circle cx="16%" cy="50%" r="2" fill="rgb(124,58,237)" opacity="0.20" />
        </g>

        {/* Lower circuit trace */}
        <g opacity="0.055" stroke="url(#svbCircuit)" strokeWidth="1.5" fill="none">
          <polyline points="35%,90% 35%,85% 48%,85% 48%,78% 60%,78%" />
          <circle cx="35%" cy="90%" r="2" fill="rgb(124,58,237)" opacity="0.20" />
          <circle cx="60%" cy="78%" r="2" fill="rgb(67,56,202)" opacity="0.18" />
        </g>

        {/* ── 2e. DOMAIN SYMBOLS ──
            Abstract learning-world metaphors, corner-positioned,
            opacity 0.04–0.07 — subconscious perception only.
        */}

        {/* CODE BRACKETS — top-right corner, tech identity */}
        <g opacity="0.065" transform="translate(81%, 4%)">
          <text fontFamily="'JetBrains Mono', monospace" fontSize="36"
                fill="rgb(67,56,202)" fontWeight="500">&lt;/&gt;</text>
        </g>

        {/* CURLY BRACES — slightly below brackets, secondary */}
        <g opacity="0.04" transform="translate(88%, 18%)">
          <text fontFamily="'JetBrains Mono', monospace" fontSize="22"
                fill="rgb(124,58,237)" fontWeight="400">&#123; &#125;</text>
        </g>

        {/* ORBIT RING — bottom-left, discovery/exploration */}
        <g opacity="0.065" transform="translate(2%, 68%)">
          <ellipse cx="58" cy="32" rx="52" ry="20"
            stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" strokeDasharray="5 7" />
          <circle cx="110" cy="32" r="5" fill="rgb(67,56,202)" opacity="0.45" />
          {/* Satellite point */}
          <circle cx="20"  cy="22" r="3" fill="rgb(124,58,237)" opacity="0.35" />
        </g>

        {/* COMPASS ROSE — lower-right, navigation/direction */}
        <g opacity="0.05" transform="translate(88%, 76%)">
          <circle cx="22" cy="22" r="20"
            stroke="rgb(245,158,11)" strokeWidth="1.5" fill="none" strokeDasharray="3 6" />
          <line x1="22" y1="2"  x2="22" y2="42"
            stroke="rgb(245,158,11)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2"  y1="22" x2="42" y2="22"
            stroke="rgb(245,158,11)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="22" cy="22" r="3" fill="rgb(245,158,11)" opacity="0.8" />
          {/* N indicator */}
          <circle cx="22" cy="5" r="2" fill="rgb(245,158,11)" opacity="0.5" />
        </g>

        {/* NODE-LINK MINI GRAPH — right mid, collaboration/network */}
        <g opacity="0.055" transform="translate(87%, 40%)">
          <circle cx="0"  cy="0"   r="6" fill="rgb(124,58,237)" />
          <circle cx="38" cy="-18" r="5" fill="rgb(67,56,202)" />
          <circle cx="38" cy="18"  r="4" fill="rgb(6,182,212)" />
          <circle cx="20" cy="32"  r="3" fill="rgb(245,158,11)" opacity="0.7" />
          <line x1="0" y1="0" x2="38" y2="-18" stroke="rgb(124,58,237)" strokeWidth="1.5" opacity="0.6" />
          <line x1="0" y1="0" x2="38" y2="18"  stroke="rgb(67,56,202)"  strokeWidth="1.5" opacity="0.6" />
          <line x1="0" y1="0" x2="20" y2="32"  stroke="rgb(245,158,11)" strokeWidth="1"   opacity="0.4" />
        </g>

        {/* INFINITY LOOP — top-center, continuous learning */}
        <g opacity="0.045" transform="translate(43%, 1%)">
          <path d="M 0 18 C 0 6 14 6 18 18 C 22 30 36 30 36 18 C 36 6 22 6 18 18 C 14 30 0 30 0 18 Z"
            stroke="rgb(67,56,202)" strokeWidth="2" fill="none" />
        </g>

        {/* BRANCHING PATH — left edge, problem-solving/decision */}
        <g opacity="0.055" transform="translate(1%, 22%)">
          <path d="M 20 0 L 20 60 M 20 30 L 0 60 M 20 30 L 40 60"
            stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none"
            strokeLinecap="round" strokeDasharray="3 6" />
          <circle cx="20" cy="0"  r="4" fill="rgb(67,56,202)"  opacity="0.4" />
          <circle cx="0"  cy="60" r="3" fill="rgb(124,58,237)" opacity="0.3" />
          <circle cx="40" cy="60" r="3" fill="rgb(6,182,212)"  opacity="0.3" />
        </g>

        {/* PUZZLE GEOMETRY — top area, problem-solving identity */}
        <g opacity="0.04" transform="translate(52%, 24%)">
          <rect x="0"  y="0"  width="18" height="18" rx="3"
            stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" />
          <rect x="20" y="0"  width="18" height="18" rx="3"
            stroke="rgb(124,58,237)" strokeWidth="1.5" fill="none" />
          <rect x="0"  y="20" width="18" height="18" rx="3"
            stroke="rgb(124,58,237)" strokeWidth="1.5" fill="none" />
          <rect x="20" y="20" width="18" height="18" rx="3"
            stroke="rgb(6,182,212)" strokeWidth="1.5" fill="none" />
          {/* Connecting notch suggestion */}
          <path d="M 18 9 Q 24 9 24 15 Q 24 20 20 20"
            stroke="rgb(67,56,202)" strokeWidth="1" fill="none" strokeDasharray="2 3" />
        </g>

        {/* DIRECTIONAL ARROW PATH — guides eye from hero into journey */}
        <g opacity="0.05" transform="translate(1%, 10%)">
          <path d="M 0 0 C 12 18 8 38 22 52"
            stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none"
            strokeLinecap="round" strokeDasharray="3 8" />
          <polygon points="17,50 22,62 27,50" fill="rgb(67,56,202)" opacity="0.35" />
        </g>

        {/* CHAT / COLLABORATION BUBBLES — bottom center, collaboration */}
        <g opacity="0.045" transform="translate(40%, 88%)">
          <rect x="0"  y="0"  width="30" height="18" rx="9"
            stroke="rgb(67,56,202)" strokeWidth="1.5" fill="none" />
          <rect x="18" y="14" width="22" height="14" rx="7"
            stroke="rgb(124,58,237)" strokeWidth="1.5" fill="none" />
          <circle cx="4"  cy="9"  r="1.5" fill="rgb(67,56,202)"  opacity="0.5" />
          <circle cx="10" cy="9"  r="1.5" fill="rgb(67,56,202)"  opacity="0.5" />
          <circle cx="16" cy="9"  r="1.5" fill="rgb(67,56,202)"  opacity="0.5" />
        </g>

      </svg>

      {/* ════════════════════════════════════════════════
          LAYER 3 — Slow orbital ambient blobs
          Very large, blurred, mix-blend-multiply
          Creates spatial depth without darkness
          ════════════════════════════════════════════════ */}
      <div className="absolute top-[-10%] left-[-10%] w-[58vw] h-[58vw] max-w-[720px] max-h-[720px] rounded-full bg-brandLight/45 blur-[150px] animate-ambient-drift-1 mix-blend-multiply opacity-55" />
      <div className="absolute bottom-[-14%] right-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full bg-lift blur-[180px] animate-ambient-drift-2 mix-blend-multiply opacity-50" />
      <div className="absolute top-[40%] right-[16%] w-[38vw] h-[38vw] max-w-[480px] max-h-[480px] rounded-full bg-accent/3 blur-[120px] animate-ambient-drift-3 mix-blend-multiply opacity-40" />
      {/* Extra subtle violet bloom — center stage */}
      <div className="absolute top-[28%] left-[30%] w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full bg-brand2/3 blur-[100px] animate-ambient-drift-1 mix-blend-multiply opacity-35" style={{ animationDelay: '8s', animationDuration: '70s' }} />

      {/* ════════════════════════════════════════════════
          LAYER 4 — Blueprint dot grid
          Masked to center so edges are always clean
          ════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(rgb(var(--color-brand)) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 48% 42%, black 15%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 48% 42%, black 15%, transparent 75%)',
        }}
      />

      {/* ════════════════════════════════════════════════
          LAYER 5 — Paper noise (tactile depth)
          ════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 opacity-[0.022] mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.80%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")' }}
      />

    </div>
  );
}
