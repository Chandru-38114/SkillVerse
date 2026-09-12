import { Link } from 'react-router-dom'
import { getSessionUser } from '../api'

const STATS = [
  { value: '2,400+', label: 'Skills exchanged' },
  { value: '98%', label: 'Session satisfaction' },
  { value: '0', label: 'Money involved' },
]

export default function Landing() {
  const user = getSessionUser()

  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-moss bg-moss/8 border border-moss/20 rounded-full px-3 py-1 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-moss inline-block" />
          A knowledge exchange, not a marketplace
        </span>

        <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6 max-w-3xl">
          Everyone here<br />
          <span className="italic text-moss">teaches</span> something.<br />
          Everyone here<br />
          <span className="italic">learns</span> something.
        </h1>

        <p className="text-lg text-ink/55 max-w-xl mb-10 leading-relaxed">
          Get skill-assessed, earn a verified badge, then trade what you know
          for what you want to learn — no money changes hands.
        </p>

        <div className="flex flex-wrap gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className="btn-primary text-base px-6 py-3">Go to dashboard</Link>
              <Link to="/marketplace" className="btn-secondary text-base px-6 py-3">Browse teachers</Link>
            </>
          ) : (
            <>
              <Link to="/signup" className="btn-primary text-base px-6 py-3">Create your profile →</Link>
              <Link to="/login" className="btn-secondary text-base px-6 py-3">Log in</Link>
            </>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-line">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl">{s.value}</p>
              <p className="text-sm text-ink/50 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white border-y border-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <p className="label-eyebrow mb-3">How it works</p>
          <h2 className="font-display text-3xl mb-12">Three steps to your first exchange</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Step
              n="01"
              title="Get assessed"
              text="A short skill test scores you and flags weak topics — no self-reporting, no inflated claims."
              icon="🧠"
            />
            <Step
              n="02"
              title="Earn a badge"
              text="Bronze to Expert. Your badge is the signal other members trust when deciding to connect."
              icon="🏅"
            />
            <Step
              n="03"
              title="Trade skills"
              text="Request a session, get accepted, chat in real-time, complete your session, and leave a review."
              icon="🤝"
            />
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-4xl mb-4">Ready to start?</h2>
        <p className="text-ink/55 mb-8">Join and take your first assessment in under 5 minutes.</p>
        {!user && (
          <Link to="/signup" className="btn-primary text-base px-8 py-3">
            Create your free profile →
          </Link>
        )}
      </section>
    </div>
  )
}

function Step({ n, title, text, icon }) {
  return (
    <div className="card-hover p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <span className="font-mono text-xs text-clay font-medium">{n}</span>
      </div>
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ink/60 leading-relaxed">{text}</p>
    </div>
  )
}