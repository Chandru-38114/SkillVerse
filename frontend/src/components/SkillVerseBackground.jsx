export default function SkillVerseBackground() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-paper transition-colors duration-1000">
      
      {/* 
        LAYER 1: Deep atmospheric base gradient
        Anchors the space with a subtle directional light.
      */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-brand2/10 dark:from-brand/10 dark:via-transparent dark:to-indigo-900/20 opacity-60" />

      {/* 
        LAYER 2: Subtle constellation/grid texture
        A radial-gradient dot pattern to give a "world/exploratory" feel.
      */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 
        LAYER 3 & 4: Slow-moving orbital shapes
        Abstract representations of learning nodes/atmosphere.
      */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-brand/15 dark:bg-brand/10 blur-[120px] animate-ambient-drift-1 mix-blend-multiply dark:mix-blend-screen opacity-70" />
      
      <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[150px] animate-ambient-drift-2 mix-blend-multiply dark:mix-blend-screen opacity-60" />
      
      <div className="absolute top-[30%] left-[20%] w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] rounded-full bg-gold/5 dark:bg-gold/10 blur-[150px] animate-ambient-drift-3 mix-blend-multiply dark:mix-blend-screen opacity-40" />

      {/* 
        LAYER 5: Edge depth / Vignette
        Draws the user's focus towards the center UI elements.
      */}
      <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_0_200px_rgba(0,0,0,0.4)]" />
      
      {/* Subtle Noise Texture Overlay (Optional, keeps it looking premium rather than digital) */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      
    </div>
  );
}
