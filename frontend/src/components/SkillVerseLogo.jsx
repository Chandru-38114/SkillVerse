import React from 'react';

export function SkillVerseMark({ className = "w-12 h-12" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SkillVerse Mark"
    >
      {/* Top stroke outline */}
      <path
        d="M74,30 C74,18 54,14 42,20 C32,25 32,36 44,40"
        stroke="#29251F"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bottom stroke outline */}
      <path
        d="M44,40 C56,44 68,48 68,60 C68,72 46,76 34,70"
        stroke="#29251F"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      {/* Top stroke color */}
      <path
        d="M74,30 C74,18 54,14 42,20 C32,25 32,36 44,40"
        stroke="#FF8A3D"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bottom stroke color */}
      <path
        d="M44,40 C56,44 68,48 68,60 C68,72 46,76 34,70"
        stroke="#6CCFB0"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      {/* Top arrowhead */}
      <polygon
        points="66,26 78,10 82,26"
        fill="#FF8A3D"
        stroke="#29251F"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Bottom arrowhead */}
      <polygon
        points="42,76 22,90 28,68"
        fill="#6CCFB0"
        stroke="#29251F"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Center node */}
      <circle
        cx="44"
        cy="40"
        r="8"
        fill="#FBEFC4"
        stroke="#29251F"
        strokeWidth="3"
      />
    </svg>
  );
}

export default function SkillVerseLogo({ className = "", compact = false, iconOnly = false }) {
  if (iconOnly) {
    return <SkillVerseMark className={className || "w-10 h-10"} />;
  }

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${compact ? 'mb-0' : 'mb-8'} ${className}`}>
      {/* S-Monogram Mark with soft shadow */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-brand/10 blur-xl rounded-full scale-125" aria-hidden="true" />
        <SkillVerseMark className={`relative z-10 ${compact ? 'w-10 h-10' : 'w-16 h-16'}`} />
      </div>

      {/* Wordmark and Tagline */}
      {!compact && (
        <div className="text-center animate-fade-in stagger-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Skill<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand2">Verse</span>
          </h1>
          <p className="text-brandInk/80 font-bold tracking-[0.25em] text-[10px] mt-2 uppercase">
            Peer-to-Peer Learning
          </p>
        </div>
      )}
    </div>
  );
}
