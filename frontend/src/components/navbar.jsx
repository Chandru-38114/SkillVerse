import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSessionUser } from '../api'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assessment', label: 'Get assessed' },
  { to: '/marketplace', label: 'Find a teacher' },
  { to: '/requests', label: 'Requests' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(getSessionUser())

  useEffect(() => {
    function onUserUpdated() {
      setUser(getSessionUser())
    }
    window.addEventListener('skillverse_user_updated', onUserUpdated)
    return () => window.removeEventListener('skillverse_user_updated', onUserUpdated)
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6 py-0 flex items-center justify-between h-14">
        {/* Logo */}
        <Link to="/" className="font-display text-lg tracking-tight shrink-0">
          Skill<span className="text-clay">Verse</span>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-ink/8 text-ink'
                      : 'text-ink/55 hover:text-ink hover:bg-ink/5'
                  }`}
                >
                  {label}
                </Link>
              )
            })}

            <span className="mx-2 text-line text-lg select-none">|</span>

            {/* Points badge */}
            <span className="text-clay font-mono text-xs font-medium bg-clay/8 border border-clay/20 px-2.5 py-1 rounded-full">
              {user.points ?? 0} pts
            </span>

            <button
              onClick={handleLogout}
              className="ml-1 btn-ghost text-sm py-1.5"
            >
              Log out
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">Log in</Link>
            <Link to="/signup" className="btn-primary text-sm py-1.5 px-4">Sign up</Link>
          </nav>
        )}
      </div>
    </header>
  )
}