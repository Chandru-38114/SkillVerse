const BADGE_STYLES = {
  Expert: 'bg-ink text-paper border border-ink',
  Gold:   'bg-[#FDF4DC] text-[#7A5F00] border border-[#C9A24B]/40',
  Silver: 'bg-ink/8 text-ink/60 border border-ink/15',
  Bronze: 'bg-clay/10 text-clay border border-clay/25',
}

const BADGE_ICONS = {
  Expert: '🏆',
  Gold:   '🥇',
  Silver: '🥈',
  Bronze: '🥉',
}

export default function SkillBadge({ badge, size = 'sm' }) {
  if (!badge) {
    return (
      <span className="text-xs text-ink/30 font-mono italic">
        unassessed
      </span>
    )
  }

  const textSize = size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${textSize} ${BADGE_STYLES[badge] || 'bg-ink/10 text-ink border border-ink/10'}`}
    >
      <span className="text-[10px]">{BADGE_ICONS[badge]}</span>
      {badge}
    </span>
  )
}