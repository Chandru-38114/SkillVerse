import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getSessionUser } from '../api'

export default function Navbar() {
  const navigate = useNavigate()
  const user = getSessionUser()

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-display text-xl tracking-tight">
          Skill<span className="text-clay">Verse</span>
        </Link>
        {user ? (
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/dashboard" className="hover:text-moss">Dashboard</Link>
            <Link to="/assessment" className="hover:text-moss">Get assessed</Link>
            <Link to="/marketplace" className="hover:text-moss">Find a teacher</Link>
            <Link to="/requests" className="hover:text-moss">Requests</Link>
            <span className="text-ink/40">|</span>
            <span className="text-clay font-mono text-xs">{user.points} pts</span>
            <button onClick={handleLogout} className="text-ink/50 hover:text-ink">Log out</button>
          </nav>
        ) : (
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link to="/login" className="hover:text-moss">Log in</Link>
            <Link to="/signup" className="btn-primary text-sm py-1.5">Sign up</Link>
          </nav>
        )}
      </div>
    </header>
  )
}