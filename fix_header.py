import re

with open('frontend/src/pages/session_room.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_header = r"  return \(\n    <div className=\"h-\[100dvh\] flex flex-col bg-\[\#FDFDFC\] overflow-hidden font-body\">\n      \{\/\* \"?\"? Header [\s\S]*?\{\/\* \"?\"? Collapsible info banner"

new_header = """  return (
    <div className="h-[100dvh] flex flex-col bg-[#FDFDFC] overflow-hidden font-body">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-line bg-white px-3 sm:px-5 flex items-center justify-between z-20 shadow-sm gap-3 h-[52px]">
        {/* Logo + session info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0" title="SkillVerse Home">
            <div className="w-7 h-7 rounded-full bg-brandLight/50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="hidden sm:block font-display text-base font-bold tracking-tight text-ink">Skill<span className="text-brand">Verse</span></span>
          </Link>
          <div className="h-5 w-px bg-line shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <p className="hidden sm:block text-[10px] text-ink/40 font-bold uppercase tracking-wider leading-none mb-0.5">
              {isTutor ? 'Teaching' : 'Learning'}
            </p>
            <h1 className="font-semibold text-sm capitalize text-ink tracking-tight truncate max-w-[180px] sm:max-w-[220px]">{session.skill}</h1>
          </div>
        </div>

        {/* Right side meta */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-3 text-xs text-ink/50 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-moss animate-pulse shrink-0" />
              {peerName && <span>with <strong className="text-ink/70">{peerName}</strong></span>}
            </div>
            <span className="text-ink/20">·</span>
            <span>{formatDate(session.session_date)}, {session.start_time}</span>
          </div>
          {/* Right side: Timer & Mobile Info toggle */}
          <div className="flex items-center gap-2">
            {timeLeft && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clay/10 text-clay font-medium text-xs">
                <span>Ends in</span>
                <span className="font-mono tracking-wider">{timeLeft}</span>
              </div>
            )}
            <button
              onClick={() => setInfoOpen(v => !v)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink/60 bg-ink/5 hover:bg-ink/10 transition-colors shrink-0"
              title="Session info"
            >
              <Info className="w-3.5 h-3.5" />
              {infoOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Collapsible info banner"""

content = re.sub(old_header, new_header, content)

with open('frontend/src/pages/session_room.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
