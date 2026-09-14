import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, Compass, MessageCircle, Calendar, Inbox, Bell, TrendingUp, Trophy, User, Settings, LogOut, Menu, X } from 'lucide-react'
import { getSessionUser, clearSession, api } from '../api'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/marketplace', label: 'Discover' },
  { to: '/messages', label: 'Connect' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/requests', label: 'Requests' },
  { to: '/progress', label: 'Progress' },
  { to: '/gamification', label: 'Skill Journey' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
]

const MOBILE_NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
  { to: '/marketplace', label: 'Discover', icon: <Compass className="w-5 h-5" /> },
  { to: '/messages', label: 'Connect', icon: <MessageCircle className="w-5 h-5" /> },
  { to: '/sessions', label: 'Sessions', icon: <Calendar className="w-5 h-5" /> },
  { to: '/requests', label: 'Requests', icon: <Inbox className="w-5 h-5" /> },
  { to: '/notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
  { to: '/progress', label: 'Progress', icon: <TrendingUp className="w-5 h-5" /> },
  { to: '/gamification', label: 'Skill Journey', icon: <Trophy className="w-5 h-5" /> },
  { to: '/profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  { to: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
]

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(getSessionUser())
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

  useEffect(() => {
    if (!user) return
    fetchUnreadCount()
    pollRef.current = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(pollRef.current)
  }, [user, fetchUnreadCount])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

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
    setMobileMenuOpen(false)
    navigate('/login')
  }

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-40 shadow-elev-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-0 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="font-display text-xl tracking-tight shrink-0 text-ink font-bold flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="text-ink">
            Skill<span className="text-brand">Verse</span>
          </div>
        </Link>

        {user ? (
          <>
            {/* Desktop Navigation */}
            <nav className="items-center gap-1 hidden xl:flex">
              {NAV_LINKS.map(({ to, label }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + '/')
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-brand/15 text-brand'
                        : 'text-clay hover:text-ink hover:bg-lift'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Right side controls */}
            <div className="flex items-center gap-2 ml-auto lg:ml-0 shrink-0">
              {/* Notification Bell (Desktop Only) */}
              <div className="relative hidden xl:block" ref={panelRef}>
                <button
                  onClick={openNotifPanel}
                  className={`relative p-2 rounded-lg transition-all ${notifOpen ? 'bg-brand/15 text-brand' : 'text-clay hover:text-brand hover:bg-brand/10'}`}
                  aria-label="Notifications"
                >
                  <BellIcon />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-12 w-full sm:w-80 bg-lift border border-line rounded-xl shadow-elev-3 overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface">
                      <span className="text-sm font-semibold text-ink">Notifications</span>
                      <div className="flex gap-3">
                        <button onClick={handleMarkAll} className="text-xs font-medium text-brand hover:underline">Mark all read</button>
                        <Link to="/notifications" onClick={() => setNotifOpen(false)} className="text-xs font-medium text-clay hover:text-ink">View all</Link>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifLoading ? (
                        <div className="p-4 text-center text-sm text-clay">Loading...</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-clay">No notifications yet</div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => notifNav(n)}
                            className={`flex gap-3 px-4 py-3 cursor-pointer border-b border-line last:border-0 transition-colors ${!n.is_read ? 'bg-brand/10 hover:bg-brand/15' : 'hover:bg-lift'}`}
                          >
                            {!n.is_read && <div className="mt-1.5 w-2 h-2 bg-brand rounded-full flex-shrink-0 shadow-sm" />}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${!n.is_read ? 'text-ink font-semibold' : 'text-ink/80 font-medium'}`}>{n.title}</p>
                              <p className="text-xs text-clay mt-0.5 truncate">{n.message}</p>
                              <p className="text-[10px] font-medium text-clay/60 mt-1 uppercase tracking-wider">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Points & Logout */}
              <div className="items-center hidden xl:flex">
                <span className="text-gold font-mono text-[11px] font-bold bg-gold/15 border border-gold/25 px-2.5 py-1 rounded-full shadow-sm mx-2">
                  {user.points ?? 0} pts
                </span>
                <div className="w-px h-5 bg-line mx-2"></div>
                <button onClick={handleLogout} className="btn-ghost text-sm py-1.5 font-semibold text-clay">
                  Log out
                </button>
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className={`xl:hidden p-2.5 ml-1 rounded-lg transition-colors border flex items-center justify-center shrink-0 min-w-[44px] min-h-[44px] ${
                  mobileMenuOpen
                    ? 'bg-brand/15 border-brand/30 text-brand'
                    : 'bg-lift border-line text-clay hover:text-ink hover:bg-surface'
                }`}
                aria-label={mobileMenuOpen ? "Close Menu" : "Open Menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
                <span className="ml-2 text-sm font-bold tracking-wide hidden sm:inline">Menu</span>
                {unreadCount > 0 && !mobileMenuOpen && (
                  <span className="absolute top-2 right-2 min-w-[12px] h-3 bg-red-500 rounded-full border border-surface"></span>
                )}
              </button>
            </div>
          </>
        ) : (
          <nav className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost font-semibold">Log in</Link>
            <Link to="/signup" className="btn-brand text-sm">Sign up</Link>
          </nav>
        )}
      </div>

      {/* Mobile/Tablet Dropdown Menu — dark-aware */}
      {user && mobileMenuOpen && (
        <div className="xl:hidden absolute top-16 left-0 w-full bg-surface border-b border-line shadow-elev-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex flex-col px-4 py-4 space-y-1">
            {MOBILE_NAV_LINKS.map(({ to, label, icon }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + '/')
              return (
                <Link
                  key={`${to}-${label}`}
                  to={to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-semibold transition-all ${
                    active
                      ? 'bg-brand/15 text-brand border border-brand/20'
                      : 'text-ink hover:bg-lift hover:text-brand'
                  }`}
                >
                  <span className={`w-6 flex items-center justify-center ${active ? 'text-brand' : 'text-clay'}`}>{icon}</span>
                  {label}
                  {label === 'Notifications' && unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}

            <hr className="border-line/60 my-4 mx-2" />

            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-gold font-mono text-[13px] font-bold bg-gold/15 border border-gold/25 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold" /> {user.points ?? 0} pts
              </span>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-[15px] font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
