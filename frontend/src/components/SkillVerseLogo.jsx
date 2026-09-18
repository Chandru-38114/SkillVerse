export default function SkillVerseLogo({ className = "", compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${compact ? 'mb-0' : 'mb-8'} ${className}`}>
      {/* Geometric 'S' Logo Graphic */}
      <div className="relative flex items-center justify-center">
        <svg
          className={`${compact ? 'w-8 h-8' : 'w-14 h-14'}`}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Glowing Background Ring */}
          <circle cx="24" cy="24" r="20" className="stroke-brand/20 dark:stroke-brand/10" strokeWidth="4" />
          
          {/* Geometric S Path */}
          <path
            d="M 32 16 C 32 16 29 12 24 12 C 18 12 16 16 16 20 C 16 25 32 23 32 28 C 32 32 30 36 24 36 C 19 36 16 32 16 32"
            className="stroke-brand"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Skill Nodes */}
          <circle cx="32" cy="16" r="3" className="fill-brand2 dark:fill-brandLight" />
          <circle cx="16" cy="32" r="3" className="fill-brand2 dark:fill-brandLight" />
          <circle cx="24" cy="24" r="2.5" className="fill-ink dark:fill-white opacity-80" />
        </svg>
      </div>
      
      {/* Wordmark and Tagline */}
      {!compact && (
        <div className="text-center">
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-ink">
            Skill<span className="text-brand">Verse</span>
          </h1>
          <p className="text-clay/80 font-semibold tracking-[0.2em] text-[10px] mt-1.5 uppercase">
            Learning is the Gameplay
          </p>
        </div>
      )}
    </div>
  );
}
