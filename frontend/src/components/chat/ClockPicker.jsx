import { useRef, useState } from 'react'

// Clock-dial time picker: tap or drag the hand to pick the hour, then the minute.
// Value is minutes after midnight (0–1439). `check(mins)` returns an error message or ''.
const SIZE = 240
const C = SIZE / 2
const R = 92
const pad = (n) => String(n).padStart(2, '0')

const toParts = (mins) => {
  const h24 = Math.floor(mins / 60)
  return { hour: h24 % 12 || 12, minute: mins % 60, pm: h24 >= 12 }
}
const fromParts = ({ hour, minute, pm }) => ((hour % 12) + (pm ? 12 : 0)) * 60 + minute
const to12h = (mins) => {
  const { hour, minute, pm } = toParts(mins)
  return `${hour}:${pad(minute)} ${pm ? 'PM' : 'AM'}`
}

const btn = (on) => ({
  border: '2px solid #29251F', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900,
  background: on ? 'var(--acc)' : '#FFFDF8', color: '#29251F',
  boxShadow: on ? '0 1px 0 #29251F' : '0 3px 0 #29251F', transform: on ? 'translateY(2px)' : 'none',
})

export default function ClockPicker({ initial, check, onDone, onCancel }) {
  const [parts, setParts] = useState(() => toParts(initial))
  const [step, setStep] = useState('hour')          // 'hour' → 'minute'
  const dial = useRef(null)
  const dragging = useRef(false)

  const mins = fromParts(parts)
  const problem = check(mins)

  function pick(e, release) {
    const box = dial.current.getBoundingClientRect()
    const x = e.clientX - box.left - box.width / 2
    const y = e.clientY - box.top - box.height / 2
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90
    if (angle < 0) angle += 360
    if (step === 'hour') {
      const hour = Math.round(angle / 30) % 12 || 12
      setParts(p => ({ ...p, hour }))
      if (release) setStep('minute')
    } else {
      const minute = Math.round(angle / 6) % 60
      setParts(p => ({ ...p, minute }))
    }
  }
  const down = (e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pick(e, false) }
  const move = (e) => { if (dragging.current) pick(e, false) }
  const up = (e) => { if (!dragging.current) return; dragging.current = false; pick(e, true) }

  const isHour = step === 'hour'
  const handDeg = isHour ? parts.hour * 30 : parts.minute * 6
  const rad = (handDeg - 90) * Math.PI / 180
  const hx = C + R * Math.cos(rad), hy = C + R * Math.sin(rad)

  return (
    <div style={{ border: '2px solid #29251F', borderRadius: 16, background: '#FFFDF8', padding: 14, boxShadow: '0 3px 0 #29251F', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {/* Big readout: tap HH or MM to switch, AM/PM on the right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button type="button" aria-label="Pick hour" onClick={() => setStep('hour')}
            style={{ ...btn(isHour), fontSize: 32, padding: '2px 10px', minWidth: 64 }}>{pad(parts.hour)}</button>
          <span style={{ fontSize: 30, fontWeight: 900, padding: '0 2px' }}>:</span>
          <button type="button" aria-label="Pick minute" onClick={() => setStep('minute')}
            style={{ ...btn(!isHour), fontSize: 32, padding: '2px 10px', minWidth: 64 }}>{pad(parts.minute)}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" aria-pressed={!parts.pm} onClick={() => setParts(p => ({ ...p, pm: false }))} style={{ ...btn(!parts.pm), fontSize: 13, padding: '3px 10px' }}>AM</button>
          <button type="button" aria-pressed={parts.pm} onClick={() => setParts(p => ({ ...p, pm: true }))} style={{ ...btn(parts.pm), fontSize: 13, padding: '3px 10px' }}>PM</button>
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
        {isHour ? 'Tap or drag to pick the hour' : 'Now pick the minute (drag for any minute)'}
      </span>

      {/* The dial */}
      <svg ref={dial} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
        aria-label={isHour ? 'Hour dial' : 'Minute dial'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ touchAction: 'none', cursor: 'pointer', userSelect: 'none', maxWidth: '100%' }}>
        <circle cx={C} cy={C} r={C - 4} fill="#F6EEDF" stroke="#29251F" strokeWidth="2" />
        {!isHour && Array.from({ length: 60 }, (_, i) => {
          const a = (i * 6 - 90) * Math.PI / 180
          const r1 = C - 10, r2 = i % 5 === 0 ? C - 18 : C - 14
          return <line key={i} x1={C + r1 * Math.cos(a)} y1={C + r1 * Math.sin(a)} x2={C + r2 * Math.cos(a)} y2={C + r2 * Math.sin(a)} stroke="#29251F" strokeOpacity=".35" strokeWidth={i % 5 === 0 ? 2 : 1} />
        })}
        <line x1={C} y1={C} x2={hx} y2={hy} stroke="#29251F" strokeWidth="2.5" />
        <circle cx={C} cy={C} r="5" fill="#29251F" />
        <circle cx={hx} cy={hy} r="17" fill="var(--acc)" stroke="#29251F" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1
          const a = (n * 30 - 90) * Math.PI / 180
          const label = isHour ? String(n) : pad((n % 12) * 5)
          return (
            <text key={n} x={C + R * Math.cos(a)} y={C + R * Math.sin(a)} textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: 15, fontWeight: 800, fill: '#29251F', pointerEvents: 'none' }}>{label}</text>
          )
        })}
      </svg>

      <div style={{ fontWeight: 800, fontSize: 14 }}>Start: {to12h(mins)} <span className="muted" style={{ fontWeight: 600 }}>IST</span></div>
      {problem && <span role="alert" style={{ color: '#9A2B1E', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>{problem}</span>}

      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button type="button" className="btn btn-s" style={{ flex: 1, minHeight: 42 }} onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-p" style={{ flex: 1, minHeight: 42 }} disabled={!!problem} onClick={() => onDone(mins)}>Set time</button>
      </div>
    </div>
  )
}
