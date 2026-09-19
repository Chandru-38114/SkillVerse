import { useMemo } from 'react';

export default function SkillVerseBackground() {
  // Generate random constellation nodes for the learning environment
  const nodes = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.4 + 0.1,
      delay: Math.random() * 5
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-paper transition-colors duration-1000">
      
      {/* 
        LAYER 1: Soft atmospheric base gradient (Ivory/Lavender Mist)
      */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-paper to-lift opacity-90" />

      {/* 
        LAYER 2: Abstract Knowledge Network / Constellation 
      */}
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--color-brand))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {nodes.map((node, i) => {
          // Connect to a few nearby nodes
          const connections = nodes.slice(i + 1, i + 3);
          return (
            <g key={node.id} className="animate-slow-pulse" style={{ animationDelay: `${node.delay}s` }}>
              <circle cx={`${node.x}%`} cy={`${node.y}%`} r={node.size} fill="rgb(var(--color-brand))" opacity={node.opacity} />
              {connections.map(target => (
                <line 
                  key={`${node.id}-${target.id}`}
                  x1={`${node.x}%`} y1={`${node.y}%`}
                  x2={`${target.x}%`} y2={`${target.y}%`}
                  stroke="url(#edgeGradient)"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* 
        LAYER 3 & 4: Slow-moving orbital shapes for environmental depth
      */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-brandLight/60 blur-[130px] animate-ambient-drift-1 mix-blend-multiply opacity-70" />
      
      <div className="absolute bottom-[-15%] right-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full bg-lift blur-[160px] animate-ambient-drift-2 mix-blend-multiply opacity-60" />
      
      <div className="absolute top-[30%] right-[20%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-accent/5 blur-[100px] animate-ambient-drift-3 mix-blend-multiply opacity-50" />

      {/* 
        LAYER 5: Blueprint Dot Grid for Structured Learning Atmosphere
      */}
      <div 
        className="absolute inset-0 opacity-[0.25]" 
        style={{ 
          backgroundImage: 'radial-gradient(rgb(var(--color-brand)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
        }} 
      />

      {/* 
        LAYER 6: Very subtle noise for texture/paper feel
      */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      
    </div>
  );
}
