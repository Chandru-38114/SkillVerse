import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSessionUser, api } from '../api'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assessment', label: 'Get assessed' },
  { to: '/marketplace', label: 'Find a teacher' },
  { to: '/requests', label: 'Requests' },
  { to: '/messages', label: 'Messages' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/progress', label: 'Progress' },
  { to: '/profile', label: 'Profile' },
]

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(getSessionUser())
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const panelRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    function onUserUpdated() {
      setUser(getSessionUser())
    }
    window.addEventListener('skillverse_user_updated', onUserUpdated)
    return () => window.removeEventListener('skillverse_user_updated', onUserUpdated)
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    if (!getSessionUser()) return
    try {
      const data = await api.getUnreadNotificationCount()
      setUnreadCount(data.unread_count || 0)
    } catch (_) {}
  }, [])

  // Poll every 30s
  useEffect(() => {
    if (!user) return
    fetchUnreadCount()
    pollRef.current = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(pollRef.current)
  }, [user, fetchUnreadCount])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function openNotifPanel() {
    setNotifOpen(o => !o)
    if (!notifOpen) {
      setNotifLoading(true)
      try {
        const data = await api.getNotifications()
        setNotifications(data.slice(0, 10))
      } catch (_) {}
      setNotifLoading(false)
    }
  }

  async function handleMarkRead(id) {
    try {
      await api.markNotificationRead(id)
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch (_) {}
  }

  async function handleMarkAll() {
    try {
      await api.markAllNotificationsRead()
      setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (_) {}
  }

  function notifNav(notif) {
    handleMarkRead(notif.id)
    setNotifOpen(false)
    switch (notif.type) {
      case 'request': navigate('/requests'); break
      case 'message': navigate('/messages'); break
      case 'session': navigate('/sessions'); break
      case 'certificate': navigate('/profile'); break
      case 'assessment': navigate('/progress'); break
      case 'review': navigate('/profile'); break
      default: navigate('/notifications'); break
    }
  }

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

            {/* Notification Bell */}
            <div className="relative" ref={panelRef}>
              <button
                onClick={openNotifPanel}
                className="relative p-1.5 rounded-lg text-ink/55 hover:text-ink hover:bg-ink/5 transition-all"
                aria-label="Notifications"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-800">Notifications</span>
                    <div className="flex gap-2">
                      <button onClick={handleMarkAll} className="text-xs text-blue-500 hover:underline">Mark all read</button>
                      <Link to="/notifications" onClick={() => setNotifOpen(false)} className="text-xs text-gray-400 hover:underline">View all</Link>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-4 text-center text-sm text-gray-400">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => notifNav(n)}
                          className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${!n.is_read ? 'bg-blue-50' : ''}`}
                        >
                          {!n.is_read && <div className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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