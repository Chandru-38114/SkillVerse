export default function SkillVerseLogo({ className = "", compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${compact ? 'mb-0' : 'mb-8'} ${className}`}>
      {/* Light-First Geometric 'S+V' Node Logo */}
      <div className="relative flex items-center justify-center">
        {/* Soft shadow/glow behind the logo */}
        <div className="absolute inset-0 bg-brand/10 blur-xl rounded-full scale-125"></div>
        
        <svg
          className={`relative z-10 ${compact ? 'w-10 h-10' : 'w-16 h-16'}`}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle node grid background */}
          <circle cx="24" cy="24" r="22" className="stroke-line" strokeWidth="1" strokeDasharray="2 6" />
          
          {/* Node Connections (V) */}
          <path
            d="M 12 14 L 24 36 L 36 14"
            className="stroke-brandLight"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* S Path representing a journey */}
          <path
            d="M 34 14 C 34 14 28 8 24 16 C 20 24 34 26 24 36 C 18 42 12 36 12 36"
            className="stroke-brand"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Learning Nodes */}
          {/* Top nodes */}
          <circle cx="12" cy="14" r="3.5" className="fill-brand drop-shadow-sm" />
          <circle cx="34" cy="14" r="3.5" className="fill-brand2 drop-shadow-sm" />
          
          {/* Middle node */}
          <circle cx="24" cy="25" r="3" className="fill-white stroke-accent stroke-2 drop-shadow-sm" />
          
          {/* Bottom node */}
          <circle cx="24" cy="36" r="3.5" className="fill-brand drop-shadow-sm" />
          <circle cx="12" cy="36" r="3" className="fill-gold drop-shadow-sm" />
        </svg>
      </div>
      
      {/* Wordmark and Tagline */}
      {!compact && (
        <div className="text-center animate-fade-in stagger-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Skill<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand2">Verse</span>
          </h1>
          <p className="text-brand/80 font-bold tracking-[0.25em] text-[10px] mt-2 uppercase">
            Peer-to-Peer Learning
          </p>
        </div>
      )}
    </div>
  );
}
