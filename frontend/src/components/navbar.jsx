import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getSessionUser, clearSession, api, getAvatarUrl } from '../api'
import './navbar.css'

/* Kit 02 · option B "Floating card", from the Navbar design.
   Connect and Journey are dropdown groups here, which is what replaced the
   old second-row sub-nav bars. */
const NAV = [
  { id: 'home', to: '/dashboard', label: 'Home' },
  { id: 'discover', to: '/marketplace', label: 'Discover' },
  {
    id: 'connect', to: '/messages', label: 'Connect',
    items: [
      { to: '/messages', label: 'Inbox', sub: 'Messages with your partners' },
      { to: '/requests', label: 'Requests', sub: 'Incoming and sent' },
      { to: '/exchanges', label: 'Exchanges', sub: 'Skill circles & groups' },
      { to: '/sessions', label: 'Sessions', sub: 'Upcoming and past' },
    ],
  },
  {
    id: 'journey', to: '/gamification', label: 'Journey',
    items: [
      { to: '/gamification', label: 'Skill Journey', sub: 'Points, badges, leaderboard' },
      { to: '/progress', label: 'Progress', sub: 'Skills and topic mastery' },
      { to: '/assessment', label: 'Assessments', sub: 'Skill Arena' },
    ],
  },
]

const CONNECT_ROUTES = ['/messages', '/requests', '/exchanges', '/sessions', '/chat']
const JOURNEY_ROUTES = ['/gamification', '/progress', '/assessment']

const Chev = () => (
  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const LogoMark = () => (
  <span className="mark" aria-hidden="true">
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {/* Top stroke: white */}
      <path
        d="M74,30 C74,18 54,14 42,20 C32,25 32,36 44,40"
        stroke="#FFFFFF"
        strokeWidth="13"
        strokeLinecap="round"
      />
      {/* Top arrowhead: white */}
      <polygon points="66,26 78,10 82,26" fill="#FFFFFF" />
      {/* Bottom stroke: white at 65% opacity */}
      <path
        d="M44,40 C56,44 68,48 68,60 C68,72 46,76 34,70"
        stroke="#FFFFFF"
        strokeOpacity="0.65"
        strokeWidth="13"
        strokeLinecap="round"
      />
      {/* Bottom arrowhead: white at 65% opacity */}
      <polygon points="42,76 22,90 28,68" fill="#FFFFFF" fillOpacity="0.65" />
      {/* Center node: white with orange ring */}
      <circle cx="44" cy="40" r="8" fill="#FFFFFF" stroke="#FF8A3D" strokeWidth="3" />
    </svg>
  </span>
)

const BellGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#29251F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </svg>
)

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(getSessionUser())
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)

  const notifRef = useRef(null)
  const profileRef = useRef(null)
  const groupRef = useRef(null)
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
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileMenuOpen(false)
      if (groupRef.current && !groupRef.current.contains(e.target)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false)
        setNotifOpen(false)
        setOpenGroup(null)
        setSheetOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setProfileMenuOpen(false)
    setNotifOpen(false)
    setOpenGroup(null)
    setSheetOpen(false)
  }, [location.pathname])

  async function openNotifPanel() {
    setNotifOpen(o => !o)
    setProfileMenuOpen(false)
    setOpenGroup(null)
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
      case 'exchange':
      case 'cycle': navigate('/exchanges'); break
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

  const isGroupActive = (n) =>
    (n.id === 'connect' && isConnectActive) ||
    (n.id === 'journey' && isJourneyActive) ||
    location.pathname === n.to || location.pathname.startsWith(n.to + '/')

  const initial = (user?.name || '?')[0].toUpperCase()
  const faceStyle = user?.profile_picture_url
    ? { backgroundImage: `url(${getAvatarUrl(user.profile_picture_url)})` }
    : undefined

  return (
    <header className="sv-nav">
      <div className="wrap">
        <div className="bar">
          <Link to={user ? '/dashboard' : '/'} className="logo" aria-label="SkillVerse home">
            <LogoMark />Skill<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand2">Verse</span>
          </Link>

          {user ? (
            <>
              <nav aria-label="Main" className="desk" ref={groupRef}>
                <ul className="links">
                  {NAV.map(n => {
                    const active = isGroupActive(n)
                    const open = openGroup === n.id
                    return (
                      <li key={n.id} style={{ position: 'relative' }}>
                        {n.items ? (
                          <button
                            type="button"
                            className={`lnk${active ? ' is-active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                            aria-expanded={open}
                            onClick={() => { setOpenGroup(open ? null : n.id); setNotifOpen(false); setProfileMenuOpen(false) }}
                          >
                            {n.label}<Chev />
                          </button>
                        ) : (
                          <Link to={n.to} className={`lnk${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                            {n.label}
                          </Link>
                        )}

                        {n.items && open && (
                          <div className="drop" role="menu">
                            {n.items.map(it => (
                              <Link
                                key={it.to}
                                to={it.to}
                                role="menuitem"
                                className={`ditem${location.pathname.startsWith(it.to) ? ' is-active' : ''}`}
                                onClick={() => setOpenGroup(null)}
                              >
                                {it.label}<small>{it.sub}</small>
                              </Link>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="right">
                <span className="pts desk">★ {user.points ?? 0} pts</span>

                <span style={{ position: 'relative' }} ref={notifRef}>
                  <button
                    type="button"
                    className="icon"
                    aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                    onClick={openNotifPanel}
                  >
                    <BellGlyph />
                    {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                  </button>

                  {notifOpen && (
                    <div className="drop right-al" style={{ minWidth: 300 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px 8px' }}>
                        <strong style={{ fontSize: 15 }}>Notifications</strong>
                        <button type="button" onClick={handleMarkAll} style={{ fontSize: 12, fontWeight: 700, color: '#29251F', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>
                      </div>
                      {notifLoading ? (
                        <span className="ditem" style={{ color: '#6E6455' }}>Loading…</span>
                      ) : notifications.length === 0 ? (
                        <span className="ditem" style={{ color: '#6E6455' }}>No notifications yet</span>
                      ) : (
                        notifications.map(n => (
                          <button
                            key={n.id}
                            type="button"
                            className={`ditem${!n.is_read ? ' is-active' : ''}`}
                            onClick={() => notifNav(n)}
                          >
                            {n.title}<small>{n.message}</small>
                          </button>
                        ))
                      )}
                      <div className="sep" />
                      <Link to="/notifications" className="ditem" onClick={() => setNotifOpen(false)}>View all</Link>
                    </div>
                  )}
                </span>

                <span style={{ position: 'relative' }} ref={profileRef}>
                  <button
                    type="button"
                    className="avatar"
                    aria-label="Account menu"
                    aria-expanded={profileMenuOpen}
                    onClick={() => { setProfileMenuOpen(p => !p); setNotifOpen(false); setOpenGroup(null) }}
                  >
                    <span className="face" style={faceStyle}>{user.profile_picture_url ? '' : initial}</span>
                    <Chev />
                  </button>

                  {profileMenuOpen && (
                    <div className="drop right-al" role="menu">
                      <div style={{ padding: '8px 12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong>{user.name}</strong>
                        <small style={{ color: '#6E6455' }}>{user.email}</small>
                      </div>
                      <div className="sep" />
                      <Link to="/profile" role="menuitem" className="ditem">Profile</Link>
                      <Link to="/settings" role="menuitem" className="ditem">Settings</Link>
                      <div className="sep" />
                      <button type="button" role="menuitem" className="ditem danger" onClick={handleLogout}>Log out</button>
                    </div>
                  )}
                </span>

                <button
                  type="button"
                  className="icon burger"
                  aria-label={sheetOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={sheetOpen}
                  style={sheetOpen ? { background: '#29251F' } : undefined}
                  onClick={() => { setSheetOpen(s => !s); setNotifOpen(false); setProfileMenuOpen(false) }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sheetOpen ? '#FFFDF8' : '#29251F'} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    {sheetOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <ul className="links desk">
                <li><Link to="/landing" className="lnk">How it works</Link></li>
                <li><Link to="/marketplace" className="lnk">Explore Skills</Link></li>
                <li><Link to="/about-skillverse" className={`lnk${location.pathname.startsWith('/about') ? ' is-active' : ''}`}>About</Link></li>
              </ul>
              <div className="right">
                <Link to="/login" className="sv-btn sv-ghost">Log in</Link>
                <Link to="/signup" className="sv-btn sv-primary">Sign up</Link>
              </div>
            </>
          )}
        </div>

        {/* phone sheet — same links, grouped */}
        {user && (
          <div className={`sheet${sheetOpen ? ' open' : ''}`}>
            <Link to="/dashboard" className={`ditem${location.pathname.startsWith('/dashboard') ? ' now' : ''}`}>Home</Link>
            <Link to="/marketplace" className={`ditem${location.pathname.startsWith('/marketplace') ? ' now' : ''}`}>Discover</Link>

            <span className="lab">CONNECT</span>
            {NAV[2].items.map(it => (
              <Link key={it.to} to={it.to} className={`ditem sub${location.pathname.startsWith(it.to) ? ' now' : ''}`}>{it.label}</Link>
            ))}

            <span className="lab">JOURNEY</span>
            {NAV[3].items.map(it => (
              <Link key={it.to} to={it.to} className={`ditem sub${location.pathname.startsWith(it.to) ? ' now' : ''}`}>{it.label}</Link>
            ))}

            <div className="sep" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                <span className="face" style={{ width: 32, height: 32, borderRadius: 999, background: '#D2BEA0', border: '2px solid #29251F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, ...(faceStyle || {}) }}>
                  {user.profile_picture_url ? '' : initial}
                </span>
                {user.name}
              </span>
              <span className="pts">★ {user.points ?? 0} pts</span>
            </div>
            <Link to="/profile" className="ditem">Profile</Link>
            <Link to="/settings" className="ditem">Settings</Link>
            <button type="button" className="ditem danger" onClick={handleLogout}>Log out</button>
          </div>
        )}
      </div>
    </header>
  )
}
