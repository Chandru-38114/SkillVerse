import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <p className="label-eyebrow mb-4">A knowledge exchange, not a marketplace</p>
      <h1 className="font-display text-5xl md:text-6xl leading-[1.05] mb-6 max-w-3xl">
        Everyone here teaches something.
        <br />Everyone here learns something.
      </h1>
      <p className="text-lg text-ink/60 max-w-xl mb-10">
        Get skill-assessed, earn a verified badge, then trade what you know for
        what you want to learn — no money changes hands.
      </p>
      <div className="flex gap-3">
        <Link to="/signup" className="btn-primary">Create your profile</Link>
        <Link to="/login" className="btn-secondary">Log in</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-24">
        <Step n="01" title="Get assessed" text="A short skill test scores you and flags weak topics — no self-reporting." />
        <Step n="02" title="Earn a badge" text="Bronze to Expert. Your badge is what other members trust." />
        <Step n="03" title="Trade skills" text="Request a session, get accepted, chat, and exchange knowledge directly." />
      </div>
    </div>
  )
}

function Step({ n, title, text }) {
  return (
    <div className="card p-6">
      <span className="font-mono text-xs text-clay">{n}</span>
      <h3 className="font-display text-xl mt-2 mb-1">{title}</h3>
      <p className="text-sm text-ink/60">{text}</p>
    </div>
  )
}