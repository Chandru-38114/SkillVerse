import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import './notifications.css';

// icon, badge colour, and the words on the "go" line — from the design
const TYPE = {
  message:     ['💬', '#E6DDF6', 'Open chat'],
  request:     ['✋', '#D6F3EA', 'View requests'],
  accepted:    ['✓', '#D6F3EA', 'Open chat'],
  session:     ['📅', '#FBEFC4', 'View sessions'],
  assessment:  ['✓', '#FFE3CF', 'View progress'],
  badge:       ['🏅', '#FBEFC4', 'View progress'],
  review:      ['★', '#FBEFC4', 'View profile'],
  certificate: ['🎓', '#E6DDF6', 'View profile'],
};
const FALLBACK = ['🔔', '#F0E5D2', 'Open'];

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error('Failed to mark read', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await api.markNotificationRead(notif.id).catch(console.error);
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }

    switch (notif.type) {
      case 'request':
        navigate('/requests');
        break;
      case 'message':
        navigate('/messages');
        break;
      case 'session':
        navigate('/sessions');
        break;
      case 'certificate':
        navigate('/profile');
        break;
      case 'assessment':
        navigate('/progress');
        break;
      case 'review':
        navigate('/profile');
        break;
      default:
        break;
    }
  };

  const requestBrowserPermission = async () => {
    if (!("Notification" in window)) {
      setPermission('unsupported');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const formatTimeAgo = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000); // seconds
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  const unread = notifications.filter(n => !n.is_read).length;
  const visible = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;

  const groups = [
    ['TODAY', visible.filter(n => isToday(n.created_at))],
    ['EARLIER', visible.filter(n => !isToday(n.created_at))],
  ].filter(g => g[1].length > 0);

  const showBanner = !loading && !bannerDismissed && permission === 'default';

  return (
    <div className="sv-notif">
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 0', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <Link to="/dashboard" style={{ fontWeight: 800, fontSize: 14, alignSelf: 'flex-start' }}>← Back to Dashboard</Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eb">INBOX</span>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 900, lineHeight: 1 }}>Notifications</h1>
            <span className="muted" style={{ fontWeight: 600 }}>Stay updated on your learning journey</span>
          </div>
          {unread > 0 && (
            <button type="button" className="btn btn-s" onClick={handleMarkAllRead}>✓ Mark all read</button>
          )}
        </div>

        {showBanner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '2px solid #29251F', borderRadius: 14, background: '#FBEFC4', flexWrap: 'wrap' }}>
            <span className="ic" style={{ background: '#FFFDF8' }} aria-hidden="true">🔔</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <strong>Get alerts on this device</strong>
              <div style={{ fontSize: 13, fontWeight: 600 }}>See new requests and messages even when SkillVerse is in another tab.</div>
            </div>
            <button type="button" className="btn btn-p" onClick={requestBrowserPermission}>Enable alerts</button>
            <button type="button" aria-label="Dismiss" onClick={() => setBannerDismissed(true)} style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>×</button>
          </div>
        )}

        <div className="seg" role="group" aria-label="Filter" style={{ alignSelf: 'flex-start' }}>
          {[['all', 'All'], ['unread', 'Unread']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'on' : ''}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
              {key === 'unread' && unread > 0 && <span className="cnt">{unread}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            <div className="sk" style={{ height: 76 }} />
            <div className="sk" style={{ height: 76 }} />
            <div className="sk" style={{ height: 76 }} />
            <div className="sk" style={{ height: 76 }} />
          </>
        ) : groups.length === 0 ? (
          <div className="card" style={{ padding: '52px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', borderStyle: 'dashed', boxShadow: 'none' }}>
            <span style={{ width: 80, height: 80, borderRadius: 22, border: '2px solid #29251F', background: '#D6F3EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, transform: 'rotate(-5deg)', boxShadow: '0 5px 0 #29251F' }}>✓</span>
            <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900 }}>
              {filter === 'unread' && notifications.length > 0 ? 'No unread notifications' : 'All caught up!'}
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              {filter === 'unread' && notifications.length > 0 ? 'You’ve read everything. Nice.' : 'You have no notifications yet.'}
            </p>
          </div>
        ) : (
          groups.map(([label, items]) => (
            <section key={label} aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eb">{label}</span>
              <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                {items.map(notif => {
                  const [icon, bg, go] = TYPE[notif.type] || FALLBACK;
                  const un = !notif.is_read;
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      className={`item${un ? ' un' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <span className="ic" style={{ background: bg }} aria-hidden="true">{icon}</span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <strong style={{ fontSize: 15, fontWeight: un ? 900 : 700, color: un ? '#29251F' : '#4A443A' }}>{notif.title}</strong>
                          <span className="mono" style={{ fontSize: 11, color: '#6E6455', whiteSpace: 'nowrap' }}>{formatTimeAgo(notif.created_at)}</span>
                        </span>
                        <span style={{ fontSize: 14, lineHeight: 1.45, fontWeight: un ? 600 : 500, color: un ? '#29251F' : '#6E6455' }}>{notif.message}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, marginTop: 2 }}>{go} →</span>
                      </span>
                      {un && (
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <span className="dot" aria-label="Unread" />
                          {/* a span, not a nested <button> — the row is already
                              a button, and activating it marks the item read */}
                          <span className="mk" onClick={(e) => handleMarkRead(e, notif.id)}>Mark read</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
