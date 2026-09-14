import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import BackButton from '../components/BackButton';
import { Bell, MessageSquare, Hand, Calendar, Award, CheckCircle, Star } from 'lucide-react';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState(Notification.permission);
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
      alert("This browser does not support desktop notification");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-5 h-5 text-brand" />;
      case 'request': return <Hand className="w-5 h-5 text-moss" />;
      case 'session': return <Calendar className="w-5 h-5 text-gold" />;
      case 'certificate': return <Award className="w-5 h-5 text-purple-500" />;
      case 'assessment': return <CheckCircle className="w-5 h-5 text-moss" />;
      case 'review': return <Star className="w-5 h-5 text-gold" />;
      default: return <Bell className="w-5 h-5 text-ink/40" />;
    }
  }

  const formatTimeAgo = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000); // seconds
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-1/4 mb-8"></div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-xl"></div>)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <BackButton to="/dashboard" className="mb-4" />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink mb-1">Notifications</h1>
          <p className="text-sm text-ink/50">Stay updated on your learning journey</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {permission !== 'granted' && (
            <button 
              onClick={requestBrowserPermission}
              className="flex-1 sm:flex-none btn-secondary text-xs px-3 py-1.5"
            >
              Enable Alerts
            </button>
          )}
          {notifications.some(n => !n.is_read) && (
            <button 
              onClick={handleMarkAllRead}
              className="flex-1 sm:flex-none btn-secondary text-xs px-3 py-1.5"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line shadow-elev-1 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-ink/20" />
            </div>
            <h3 className="font-bold text-lg mb-1">All caught up!</h3>
            <p className="text-sm text-ink/50">You have no new notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {notifications.map(notif => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 sm:p-5 cursor-pointer hover:bg-paper transition-colors flex items-start gap-4 ${!notif.is_read ? 'bg-brandLight/5' : ''}`}
              >
                <div className="shrink-0 mt-1">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className={`text-sm font-semibold truncate ${!notif.is_read ? 'text-ink' : 'text-ink/70'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] font-medium text-ink/40 shrink-0 whitespace-nowrap mt-0.5">
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed break-words ${!notif.is_read ? 'text-ink/80' : 'text-ink/60'}`}>
                    {notif.message}
                  </p>
                </div>
                {!notif.is_read && (
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-brand rounded-full mt-2 shadow-[0_0_8px_rgba(23,96,255,0.4)]"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
