import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';

interface Notification {
  id: string;
  type: 'new_video' | 'new_follower' | 'like' | 'comment';
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  videoId?: string;
  videoThumbnail?: string;
  message: string;
  timestamp: any;
  read: boolean;
}

interface NotificationsPanelProps {
  onVideoClick?: (videoId: string) => void;
  onProfileClick?: (userId: string) => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ onVideoClick, onProfileClick }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications: Notification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      setNotifications(fetchedNotifications);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(n => 
          updateDoc(doc(db, 'notifications', n.id), { read: true })
        )
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_video':
        return 'fa-solid fa-video text-accent';
      case 'new_follower':
        return 'fa-solid fa-user-plus text-blue-400';
      case 'like':
        return 'fa-solid fa-heart text-red-400';
      case 'comment':
        return 'fa-solid fa-comment text-green-400';
      default:
        return 'fa-solid fa-bell text-gray-400';
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds/60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds/3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds/86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.type === 'new_video' && notification.videoId) {
      onVideoClick?.(notification.videoId);
    } else if (notification.type === 'new_follower') {
      onProfileClick?.(notification.fromUserId);
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!currentUser) {
    return (
      <div className="p-6 text-center">
        <i className="fa-solid fa-bell-slash text-4xl text-gray-600 mb-3"></i>
        <p className="text-sm text-gray-400">Login to see notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-bell text-accent"></i>
            Notifications
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-accent hover:text-white transition-colors font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
              filter === 'all'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
              filter === 'unread'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-gray-500"></i>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-6 text-center">
            <i className="fa-regular fa-bell text-4xl text-gray-600 mb-3"></i>
            <p className="text-sm text-gray-400">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 hover:bg-white/5 cursor-pointer transition-colors ${
                  !notification.read ? 'bg-accent/5' : ''
                }`}
              >
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={notification.fromUserAvatar}
                      alt={notification.fromUserName}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    {/* Notification Type Icon */}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center">
                      <i className={`${getNotificationIcon(notification.type)} text-[10px]`}></i>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white mb-1">
                      <span className="font-bold">{notification.fromUserName}</span>
                      {' '}
                      <span className="text-gray-400">{notification.message}</span>
                    </p>
                    <p className="text-xs text-gray-500">{formatTime(notification.timestamp)}</p>
                  </div>

                  {/* Video Thumbnail (if applicable) */}
                  {notification.videoThumbnail && (
                    <div className="flex-shrink-0">
                      <img
                        src={notification.videoThumbnail}
                        alt="Video"
                        className="w-12 h-12 rounded-lg object-cover border border-white/10"
                      />
                    </div>
                  )}

                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-accent"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
