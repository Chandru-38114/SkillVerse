export default function SkillVerseBackground() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-paper transition-colors duration-500">
      {/* 
        The background consists of a base color (bg-paper) 
        and three large, highly blurred orbs that drift slowly to create a "world" feel.
        Animations are defined in index.css and respect prefers-reduced-motion.
      */}
      
      {/* Primary Brand Orb */}
      <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-brand/15 dark:bg-brand/10 blur-[100px] animate-ambient-drift-1 mix-blend-multiply dark:mix-blend-screen opacity-70" />
      
      {/* Secondary Gold Orb */}
      <div className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gold/15 dark:bg-gold/10 blur-[120px] animate-ambient-drift-2 mix-blend-multiply dark:mix-blend-screen opacity-60" />
      
      {/* Deep Atmosphere Orb */}
      <div className="absolute -bottom-[20%] left-[20%] w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] rounded-full bg-brand2/10 dark:bg-brandLight/15 blur-[150px] animate-ambient-drift-3 mix-blend-multiply dark:mix-blend-screen opacity-50" />
      
      {/* Subtle Noise Texture Overlay (Optional, keeps it looking premium rather than digital) */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
    </div>
  );
}
