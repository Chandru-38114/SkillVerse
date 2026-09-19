import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, Compass, MessageCircle, Calendar, Inbox, Bell, TrendingUp, Trophy, User, Settings, LogOut, Menu, X } from 'lucide-react'
import { getSessionUser, clearSession, api, getAvatarUrl } from '../api'

const PRIMARY_NAV = [
  { to: '/dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
  { to: '/marketplace', label: 'Discover', icon: <Compass className="w-5 h-5" /> },
  { to: '/messages', label: 'Connect', icon: <MessageCircle className="w-5 h-5" /> },
  { to: '/gamification', label: 'Journey', icon: <Trophy className="w-5 h-5" /> },
]

const CONNECT_ROUTES = ['/messages', '/requests', '/sessions', '/chat']
const JOURNEY_ROUTES = ['/gamification', '/progress', '/assessment']

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  
  const notifRef = useRef(null)
  const profileRef = useRef(null)
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
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setProfileMenuOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  async function openNotifPanel() {
    setNotifOpen(o => !o)
    setProfileMenuOpen(false)
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

  const isConnectActive = CONNECT_ROUTES.some(r => location.pathname.startsWith(r))
  const isJourneyActive = JOURNEY_ROUTES.some(r => location.pathname.startsWith(r))

  return (
    <>
      <header className="bg-surface border-b border-line sticky top-0 z-40 shadow-elev-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-0 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="font-display text-xl tracking-tight shrink-0 text-ink font-bold flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative transition-transform group-hover:scale-105 duration-300">
              <div className="absolute inset-0 bg-brand/10 blur-md rounded-full scale-125 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <svg className="w-6 h-6 relative z-10" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* SV Monogram / Node Network */}
                <path d="M14 34 L14 18 C14 13 20 12 24 16 C28 20 34 19 34 14 L34 30" stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 34 L24 44 L34 30" stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Nodes */}
                <circle cx="14" cy="18" r="4" className="fill-brand" />
                <circle cx="34" cy="14" r="3" className="fill-brand2" />
                <circle cx="14" cy="34" r="3" className="fill-accent" />
                <circle cx="34" cy="30" r="3.5" className="fill-brand" />
                <circle cx="24" cy="44" r="4" className="fill-gold" />
                
                <defs>
                  <linearGradient id="logoGrad" x1="14" y1="14" x2="34" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgb(var(--color-brand))" />
                    <stop offset="1" stopColor="rgb(var(--color-accent))" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="text-ink drop-shadow-sm ml-0.5">
              Skill<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand2">Verse</span>
            </div>
          </Link>

          {user ? (
            <>
              {/* Desktop Navigation */}
              <nav className="items-center gap-1 hidden xl:flex">
                {PRIMARY_NAV.map(({ to, label }) => {
                  const active = (label === 'Connect' && isConnectActive) ||
                                 (label === 'Journey' && isJourneyActive) ||
                                 location.pathname === to || location.pathname.startsWith(to + '/');
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
              <div className="flex items-center gap-3 ml-auto lg:ml-0 shrink-0">
                {/* Desktop Points */}
                <div className="items-center hidden xl:flex">
                  <span className="text-gold font-mono text-[11px] font-bold bg-gold/15 border border-gold/25 px-2.5 py-1 rounded-full shadow-sm mx-2">
                    {user.points ?? 0} pts
                  </span>
                  <div className="w-px h-5 bg-line mx-2"></div>
                </div>

                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
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
                    <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-80 bg-lift border border-line rounded-xl shadow-elev-3 overflow-hidden z-50">
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

                {/* Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                  <button 
                    onClick={() => {
                      setProfileMenuOpen(p => !p)
                      setNotifOpen(false)
                    }}
                    className="w-9 h-9 rounded-full bg-ink/10 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity border border-line"
                  >
                    {user.profile_picture_url ? (
                      <img src={getAvatarUrl(user.profile_picture_url)} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-clay" />
                    )}
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-12 w-48 bg-surface border border-line rounded-xl shadow-elev-3 overflow-hidden z-50 py-1">
                      <div className="xl:hidden px-4 py-3 border-b border-line mb-1 flex items-center justify-between">
                         <span className="text-sm font-semibold text-ink">Points</span>
                         <span className="text-gold font-mono text-[11px] font-bold bg-gold/15 border border-gold/25 px-2.5 py-1 rounded-full shadow-sm">
                           {user.points ?? 0} pts
                         </span>
                      </div>
                      <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-lift transition-colors"><User className="w-4 h-4 text-clay"/> Profile</Link>
                      <Link to="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-lift transition-colors"><Settings className="w-4 h-4 text-clay"/> Settings</Link>
                      <div className="h-px bg-line my-1"></div>
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                        <LogOut className="w-4 h-4"/> Log out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <nav className="flex items-center gap-3">
              <Link to="/login" className="btn-ghost font-semibold">Log in</Link>
              <Link to="/signup" className="btn-brand text-sm">Sign up</Link>
            </nav>
          )}
        </div>
        
        {/* Sub-Nav Bars */}
        {user && isConnectActive && (
          <div className="bg-surface border-t border-line overflow-x-auto no-scrollbar">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-4 py-1.5">
              {[
                { to: '/messages', label: 'Inbox' },
                { to: '/requests', label: 'Requests' },
                { to: '/sessions', label: 'Sessions' }
              ].map(link => {
                const active = location.pathname.startsWith(link.to);
                return (
                  <Link key={link.to} to={link.to} className={`px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${active ? 'border-brand text-brand' : 'border-transparent text-clay hover:text-ink'}`}>
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        {user && isJourneyActive && (
          <div className="bg-surface border-t border-line overflow-x-auto no-scrollbar">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-4 py-1.5">
              {[
                { to: '/gamification', label: 'Skill Journey' },
                { to: '/progress', label: 'Progress' },
                { to: '/assessment', label: 'Assessments' }
              ].map(link => {
                const active = location.pathname.startsWith(link.to);
                return (
                  <Link key={link.to} to={link.to} className={`px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${active ? 'border-brand text-brand' : 'border-transparent text-clay hover:text-ink'}`}>
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation */}
      {user && (
        <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-line shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around items-center h-[68px] px-2">
            {PRIMARY_NAV.map(({ to, label, icon }) => {
              const active = (label === 'Connect' && isConnectActive) ||
                             (label === 'Journey' && isJourneyActive) ||
                             location.pathname === to || location.pathname.startsWith(to + '/');
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                    active ? 'text-brand' : 'text-clay hover:text-ink'
                  }`}
                >
                  <div className={`p-1.5 rounded-full transition-colors ${active ? 'bg-brand/15 text-brand' : ''}`}>
                    {icon}
                  </div>
                  <span className={`text-[10px] ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
