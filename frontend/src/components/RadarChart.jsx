// Spider-web ("radar") chart in the SkillVerse sticker style.
// axes: [{ label: 'Loops', value: 72, display?: '72%' }] — value is 0..100.
// Needs at least 3 axes (with fewer there is no shape to draw; callers show bars).
const INK = '#29251F'

export default function RadarChart({ axes, size = 320, color = '#F7894A', fill = 'rgba(247,137,74,0.28)', rings = 4 }) {
  const n = axes.length
  if (n < 3) return null

  const pad = 78                      // room for the labels around the web
  const box = size + pad * 2
  const c = box / 2
  const r = size / 2
  const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n   // first axis points up
  const point = (i, pct) => {
    const k = (Math.max(0, Math.min(100, pct)) / 100) * r
    return [c + k * Math.cos(angle(i)), c + k * Math.sin(angle(i))]
  }
  const poly = (pct) => axes.map((_, i) => point(i, pct).join(',')).join(' ')
  const shape = axes.map((a, i) => point(i, a.value).join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${box} ${box}`} width="100%" style={{ maxWidth: box, display: 'block', margin: '0 auto' }} role="img"
      aria-label={axes.map(a => `${a.label}: ${a.display ?? Math.round(a.value)}`).join(', ')}>
      <style>{`
        @keyframes svRadarGrow { from { transform: scale(0.05); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .sv-radar-shape { animation: none !important } }
      `}</style>

      {/* the web: rings + spokes */}
      {Array.from({ length: rings }, (_, i) => rings - 1 - i).map((k) => (   /* outer (filled) ring first */
        <polygon key={k} points={poly(((k + 1) / rings) * 100)} fill={k === rings - 1 ? '#FFFDF8' : 'none'}
          stroke={INK} strokeOpacity={k === rings - 1 ? 0.9 : 0.25} strokeWidth={k === rings - 1 ? 2 : 1}
          strokeDasharray={k === rings - 1 ? undefined : '3 5'} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 100)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={INK} strokeOpacity="0.22" strokeWidth="1" />
      })}

      {/* the value shape grows in from the centre */}
      <g className="sv-radar-shape" style={{ transformOrigin: `${c}px ${c}px`, animation: 'svRadarGrow .7s cubic-bezier(.2,.9,.3,1.2) both' }}>
        <polygon points={shape} fill={fill} stroke={color} strokeWidth="3" strokeLinejoin="round" />
        {axes.map((a, i) => {
          const [x, y] = point(i, a.value)
          return <circle key={i} cx={x} cy={y} r="5.5" fill={color} stroke={INK} strokeWidth="2" />
        })}
      </g>

      {/* labels: name + value, pushed outside the web */}
      {axes.map((a, i) => {
        const cos = Math.cos(angle(i)), sin = Math.sin(angle(i))
        const [x, y] = point(i, 100)
        const gap = 12
        const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end'
        const lx = x + (anchor === 'middle' ? 0 : cos > 0 ? gap : -gap)
        // top labels sit fully above the web, bottom labels fully below,
        // side labels are centred on the corner
        const top = sin < -0.5 ? y - gap - 18 : sin > 0.5 ? y + gap + 4 : y - 9
        const label = a.label.length > 18 ? a.label.slice(0, 17) + '…' : a.label
        return (
          <g key={i}>
            <title>{`${a.label}: ${a.display ?? Math.round(a.value) + '%'}`}</title>
            <text x={lx} y={top + 11} textAnchor={anchor} fontSize="13" fontWeight="800" fill={INK}>{label}</text>
            <text x={lx} y={top + 27} textAnchor={anchor} fontSize="12" fontWeight="700" fill={INK} opacity="0.6"
              fontFamily="'JetBrains Mono', monospace">{a.display ?? `${Math.round(a.value)}%`}</text>
          </g>
        )
      })}
    </svg>
  )
}
