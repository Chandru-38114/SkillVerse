import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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

  const handleMarkRead = async (id) => {
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
      await handleMarkRead(notif.id);
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
        navigate('/profile'); // or wherever certificates are viewed
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

  if (loading) return <div className="p-8 text-center">Loading notifications...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex gap-4">
          {permission !== 'granted' && (
            <button 
              onClick={requestBrowserPermission}
              className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
            >
              Enable Browser Alerts
            </button>
          )}
          <button 
            onClick={handleMarkAllRead}
            className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300"
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            You have no notifications.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map(notif => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 cursor-pointer hover:bg-gray-50 flex items-start gap-4 ${!notif.is_read ? 'bg-blue-50' : ''}`}
              >
                {!notif.is_read && (
                  <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                )}
                <div className="flex-1">
                  <h3 className={`text-sm font-medium ${!notif.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                    {notif.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
