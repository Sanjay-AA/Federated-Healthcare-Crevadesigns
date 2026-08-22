import React from 'react';
import { AlertCircle, AlertTriangle, Info, Check, Trash2, X } from 'lucide-react';

const NotificationPanel = ({ notifications, onMarkAsRead, onClearAll, onClose }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="text-red" size={18} style={{ color: '#dc2626' }} />;
      case 'warning':
        return <AlertTriangle className="text-yellow" size={18} style={{ color: '#d97706' }} />;
      default:
        return <Info className="text-blue" size={18} style={{ color: '#0284c7' }} />;
    }
  };

  return (
    <div className="notification-dropdown" id="notification-panel">
      <div className="notif-header">
        <h4>Notifications</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {notifications.length > 0 && (
            <button 
              className="clear-notifs-btn" 
              onClick={onClearAll}
              title="Clear all notifications"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Trash2 size={12} /> Clear All
            </button>
          )}
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '2px' }}
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div className="notif-list">
        {notifications.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No new notifications
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`notif-item ${!notif.read ? 'unread' : ''}`}
              onClick={() => onMarkAsRead(notif.id)}
              id={`notif-item-${notif.id}`}
            >
              <div className="notif-icon-wrapper">
                {getIcon(notif.type)}
              </div>
              <div className="notif-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="notif-title">{notif.title}</span>
                  {!notif.read && (
                    <span 
                      style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: '#ef4444', 
                        display: 'block',
                        marginTop: '5px' 
                      }} 
                    />
                  )}
                </div>
                <span className="notif-desc">{notif.message}</span>
                {notif.detail && (
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {notif.detail}
                  </span>
                )}
                <span className="notif-time">{notif.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
