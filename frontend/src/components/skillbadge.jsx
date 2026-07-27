const BADGE_STYLES = {
  Expert: "bg-ink text-paper",
  Gold: "bg-gold/20 text-[#8a6b1f] border border-gold/40",
  Silver: "bg-ink/10 text-ink/70 border border-ink/15",
  Bronze: "bg-clay/15 text-clay border border-clay/30",
}

export default function SkillBadge({ badge }) {
  if (!badge) {
    return <span className="text-xs text-ink/40 font-mono">unassessed</span>
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE_STYLES[badge] || "bg-ink/10"}`}>
      {badge}
    </span>
  )
}