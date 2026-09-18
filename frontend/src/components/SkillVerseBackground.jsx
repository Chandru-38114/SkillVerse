export default function SkillVerseBackground() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-paper transition-colors duration-1000">
      
      {/* 
        LAYER 1: Deep atmospheric base gradient
      */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brandLight/40 via-paper to-paper opacity-80" />

      {/* 
        LAYER 2: Subtle constellation/grid texture
      */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* 
        LAYER 3 & 4: Slow-moving orbital shapes
      */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-brand/10 blur-[130px] animate-ambient-drift-1 mix-blend-multiply opacity-50" />
      
      <div className="absolute bottom-[-15%] right-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full bg-brand2/10 blur-[160px] animate-ambient-drift-2 mix-blend-multiply opacity-40" />
      
      <div className="absolute top-[40%] right-[30%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-accent/5 blur-[100px] animate-ambient-drift-3 mix-blend-multiply opacity-30" />

      {/* 
        LAYER 5: Edge depth / Vignette (Light mode)
      */}
      <div className="absolute inset-0 shadow-[inset_0_0_250px_rgba(255,255,255,0.5)]" />
      
      {/* Subtle Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      
    </div>
  );
}
