import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, FileEdit, History, LogOut, MapPin, User, X } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';

const Sidebar = ({ isOpen, onClose }) => {
  const [phc, setPhc] = useState(null);

  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const data = await inventoryService.getPHCIdentity();
        setPhc(data);
      } catch (err) {
        console.error("Failed to load PHC details in sidebar", err);
      }
    };
    fetchIdentity();
  }, []);

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <div 
        className={`mobile-overlay ${isOpen ? 'mobile-open' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        {/* Header / Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>CREVA HEALTH</h1>
              <p>PHC Inventory Portal</p>
            </div>
            {/* Close button for mobile drawer view */}
            <button 
              onClick={onClose} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                display: 'none' /* Will show up in CSS for responsive under mobile breakpoint */
              }}
              className="hamburger-btn"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/inventory" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Package size={18} />
            <span>Inventory</span>
          </NavLink>

          <NavLink 
            to="/inventory/update" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <FileEdit size={18} />
            <span>Update Stock</span>
          </NavLink>

          <NavLink 
            to="/history" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <History size={18} />
            <span>History</span>
          </NavLink>
        </nav>

        {/* PHC Identity Footer */}
        {phc && (
          <div className="sidebar-footer">
            <div className="phc-info-badge">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <MapPin size={14} style={{ color: '#0ea5e9', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <h4>{phc.name}</h4>
                  <p>{phc.district} District</p>
                  <p>{phc.state}</p>
                </div>
              </div>
            </div>

            <div className="user-info-section">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <User size={14} style={{ color: '#94a3b8', margin: 'auto' }} />
                </div>
                <div className="user-details">
                  <span className="user-name">{phc.officerRole}</span>
                  <span className="user-role">ID: {phc.id}</span>
                </div>
              </div>

              <button 
                className="logout-btn" 
                title="Logout (Visual only)"
                onClick={() => alert("Logout button clicked. Authentication will be implemented in later phases.")}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
