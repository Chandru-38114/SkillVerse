
/* ── Geometric line icon SVG components ────────────────────────────────────────── */

export const BadgeIcons = {
  // Grad cap: Bronze "First Class"
  grad_cap: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
    </svg>
  ),

  // Bolt: Bronze "Quick Responder"
  bolt: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),

  // Overlapping chat bubbles: Silver "Study Circle Regular"
  chat_bubbles: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M14 9a2 2 0 0 1-2 2H6l-3 3V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2z" />
      <path d="M18 9h1a2 2 0 0 1 2 2v7l-3-3h-4a2 2 0 0 1-2-2v-1" />
    </svg>
  ),

  // Chat with checkmark: Silver "Senior Advisor"
  chat_check: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="m9 10 2 2 4-4" />
    </svg>
  ),

  // Star: Gold "Five-Star Mentor"
  star: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),

  // Three-dot triangle: Gold "Circle Builder"
  triangle_dots: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <circle cx="12" cy="5" r="2.5" fill="currentColor" />
      <circle cx="5" cy="19" r="2.5" fill="currentColor" />
      <circle cx="19" cy="19" r="2.5" fill="currentColor" />
      <path d="M10 7.5 6.5 16.5" strokeDasharray="2 2" />
      <path d="M7.5 19h9" strokeDasharray="2 2" />
      <path d="M17.5 16.5 14 7.5" strokeDasharray="2 2" />
    </svg>
  ),

  // Flag: Gold "Hackathon Host"
  flag: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),

  // Trophy: Expert "Centurion"
  trophy: ({ className = "w-4 h-4", ...props }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M6 3h12v7a6 6 0 0 1-12 0V3z" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </svg>
  ),
};

export function BadgeIcon({ name, className = "w-4 h-4" }) {
  const IconComponent = BadgeIcons[name] || BadgeIcons.star;
  return <IconComponent className={className} />;
}

/* ── Existing tier styles matching skillbadge.jsx ─────────────────────────────── */

export const BADGE_TIER_STYLES = {
  expert: 'bg-ink text-paper border border-ink',
  gold:   'bg-[#FDF4DC] text-[#7A5F00] border border-[#C9A24B]/40',
  silver: 'bg-ink/8 text-ink/60 border border-ink/15',
  bronze: 'bg-clay/10 text-clay border border-clay/25',
  Expert: 'bg-ink text-paper border border-ink',
  Gold:   'bg-[#FDF4DC] text-[#7A5F00] border border-[#C9A24B]/40',
  Silver: 'bg-ink/8 text-ink/60 border border-ink/15',
  Bronze: 'bg-clay/10 text-clay border border-clay/25',
};

/* ── 8 Teacher Badge Definitions (reusing bronze/silver/gold/expert tiers) ───── */

export const TEACHER_BADGES = {
  // Bronze Tier
  first_class: {
    id: 'first_class',
    name: 'First Class',
    tier: 'bronze',
    description: 'Taught first completed session',
    icon: 'grad_cap',
    computable: true,
  },
  quick_responder: {
    id: 'quick_responder',
    name: 'Quick Responder',
    tier: 'bronze',
    description: '20 replies within 2 hours',
    icon: 'bolt',
    computable: false,
    stubbed: true,
    stubReason: 'Depends on response time tracking (Task 4A/community feature)',
  },

  // Silver Tier
  study_circle_regular: {
    id: 'study_circle_regular',
    name: 'Study Circle Regular',
    tier: 'silver',
    description: '5 study circles attended',
    icon: 'chat_bubbles',
    computable: false,
    stubbed: true,
    stubReason: 'Depends on Study Circles community feature (Task 4A)',
  },
  senior_advisor: {
    id: 'senior_advisor',
    name: 'Senior Advisor',
    tier: 'silver',
    description: '10 Ask-a-Senior answers',
    icon: 'chat_check',
    computable: false,
    stubbed: true,
    stubReason: 'Depends on Ask-a-Senior community feature (Task 4A)',
  },

  // Gold Tier
  five_star_mentor: {
    id: 'five_star_mentor',
    name: 'Five-Star Mentor',
    tier: 'gold',
    description: '4.8+ rating over 10+ sessions',
    icon: 'star',
    computable: true,
  },
  circle_builder: {
    id: 'circle_builder',
    name: 'Circle Builder',
    tier: 'gold',
    description: 'Completed a three-way exchange circle',
    icon: 'triangle_dots',
    computable: true,
  },
  hackathon_host: {
    id: 'hackathon_host',
    name: 'Hackathon Host',
    tier: 'gold',
    description: 'Ran a community hackathon',
    icon: 'flag',
    computable: false,
    stubbed: true,
    stubReason: 'Depends on Community Hackathons feature (Task 4A)',
  },

  // Expert Tier
  centurion: {
    id: 'centurion',
    name: 'Centurion',
    tier: 'expert',
    description: '100 completed teaching sessions',
    icon: 'trophy',
    computable: true,
  },
};

export const TEACHER_BADGE_LIST = Object.values(TEACHER_BADGES);

/* ── TeacherBadge UI component matching skillbadge.jsx pattern ──────────────── */

export function TeacherBadge({ badge, size = 'sm', showDescription = false }) {
  if (!badge) return null;
  const defn = typeof badge === 'string' ? TEACHER_BADGES[badge] : badge;
  if (!defn) return null;

  const tierKey = defn.tier ? defn.tier.toLowerCase() : 'bronze';
  const tierClass = BADGE_TIER_STYLES[tierKey] || BADGE_TIER_STYLES.bronze;
  const padding = size === 'lg' ? 'px-3 py-1.5 text-sm gap-2' : 'px-2.5 py-1 text-xs gap-1.5';
  const iconSize = size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-sm ${padding} ${tierClass}`}
      title={defn.description}
    >
      <BadgeIcon name={defn.icon} className={iconSize} />
      <span>{defn.name}</span>
      {showDescription && (
        <span className="opacity-70 font-normal ml-1">· {defn.description}</span>
      )}
    </span>
  );
}

/* ── Legacy BADGE_VARIANTS (preserved for backward compatibility) ───────────── */

export const BADGE_VARIANTS = {
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Discovered 5 new skill paths',
    icon: 'Compass',
    color: 'from-blue-500 to-cyan-400',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    shape: 'hexagon'
  },
  skillMaster: {
    id: 'skillMaster',
    name: 'Skill Master',
    description: 'Completed 10 advanced sessions',
    icon: 'Crown',
    color: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251, 146, 60, 0.5)',
    shape: 'shield'
  },
  mentor: {
    id: 'mentor',
    name: 'Trusted Mentor',
    description: 'Received 50 positive reviews',
    icon: 'Star',
    color: 'from-purple-500 to-fuchsia-400',
    glowColor: 'rgba(217, 70, 239, 0.5)',
    shape: 'circle'
  },
  communityBuilder: {
    id: 'communityBuilder',
    name: 'Community Builder',
    description: 'Initiated 20 group learning sessions',
    icon: 'Users',
    color: 'from-emerald-400 to-teal-500',
    glowColor: 'rgba(45, 212, 191, 0.5)',
    shape: 'octagon'
  },
  fastLearner: {
    id: 'fastLearner',
    name: 'Fast Learner',
    description: 'Completed a path in record time',
    icon: 'Zap',
    color: 'from-rose-400 to-pink-500',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    shape: 'diamond'
  },
  // Map teacher badges into BADGE_VARIANTS for unified registry lookup
  ...TEACHER_BADGES
};
