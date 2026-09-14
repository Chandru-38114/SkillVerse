export default function SkillVerseLogo({ className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center space-y-3 mb-8 ${className}`}>
      {/* Logo Graphic */}
      <div className="relative w-16 h-16 flex items-center justify-center bg-brand/15 rounded-full">
        {/* Open Book Concept */}
        <svg className="w-10 h-10 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {/* Two Learners / Graduation Element Overlay */}
        <div className="absolute inset-0 flex items-center justify-center translate-y-[-4px]">
          {/* Learner 1 */}
          <div className="absolute left-3 top-3 text-brand2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          {/* Learner 2 */}
          <div className="absolute right-3 top-3 text-ink">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          {/* Graduation Cap */}
          <div className="absolute top-0 text-brand2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72l5 2.73 5-2.73v3.72z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Wordmark and Tagline */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Skill<span className="text-brand">Verse</span>
        </h1>
        <p className="text-clay font-medium tracking-wide text-xs mt-1 uppercase">
          Peer to Peer Learning
        </p>
      </div>
    </div>
  );
}
