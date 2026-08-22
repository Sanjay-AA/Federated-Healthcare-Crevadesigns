import React, { useEffect, useState, useRef } from 'react';
import { Bell, Menu, Globe, AlertCircle } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import NotificationPanel from './NotificationPanel';

const Header = ({ onMenuToggle, notifications = [], onMarkAsRead, onClearAll }) => {
  const [phc, setPhc] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [lang, setLang] = useState('en');
  const panelRef = useRef(null);

  useEffect(() => {
    const fetchPHC = async () => {
      try {
        const data = await inventoryService.getPHCIdentity();
        setPhc(data);
      } catch (err) {
        console.error("Failed to load PHC details in header", err);
      }
    };
    fetchPHC();
  }, []);

  // Close notifications panel on clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        // Check if click was on notification toggle button
        const toggleBtn = document.getElementById('notif-toggle-btn');
        if (toggleBtn && !toggleBtn.contains(event.target)) {
          setShowNotifs(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="header">
      {/* Left Section: PHC Title & Info */}
      <div className="header-title-section">
        {/* Toggle Button for mobile viewports */}
        <button 
          onClick={onMenuToggle}
          className="icon-btn"
          style={{ display: 'none', marginRight: '8px' }} // Controlled in media query css
          id="mobile-menu-toggle-btn"
          title="Toggle Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <h2>PHC Portal</h2>
        {phc && (
          <>
            <div className="header-divider" />
            <span className="header-location">{phc.name}</span>
            <div className="operational-dot-badge">
              {phc.status}
            </div>
          </>
        )}
      </div>

      {/* Right Section: Language, Notifications & Profile */}
      <div className="header-actions">
        {/* Language Selector */}
        <div className="lang-selector-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={14} style={{ color: 'var(--text-muted)' }} />
          <select 
            className="lang-select" 
            value={lang} 
            onChange={(e) => {
              setLang(e.target.value);
              // Visual warning for Phase 1
              console.log(`Language changed to: ${e.target.value}`);
            }}
            title="Language selector (Visual only)"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="ta">தமிழ்</option>
            <option value="ml">മലയാളം</option>
          </select>
        </div>

        {/* Notifications Icon & Dropdown */}
        <div className="icon-btn-container" style={{ position: 'relative' }}>
          <button 
            className="icon-btn" 
            id="notif-toggle-btn"
            onClick={() => setShowNotifs(!showNotifs)}
            title="Notifications panel"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="badge-count">{unreadCount}</span>
            )}
          </button>

          {showNotifs && (
            <div ref={panelRef} style={{ position: 'absolute', right: 0, top: '42px', zIndex: 1000 }}>
              <NotificationPanel 
                notifications={notifications}
                onMarkAsRead={onMarkAsRead}
                onClearAll={onClearAll}
                onClose={() => setShowNotifs(false)}
              />
            </div>
          )}
        </div>

        {/* User Profile / Avatar */}
        <div 
          className="header-user-avatar" 
          title="PHC Inventory Officer Raman Kumar"
        >
          RK
        </div>
      </div>
    </header>
  );
};

export default Header;
