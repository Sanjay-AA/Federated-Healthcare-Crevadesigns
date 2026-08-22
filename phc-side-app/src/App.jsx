import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { inventoryService } from './services/inventoryService';

// Layout components
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Page components
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import MedicineDetail from './pages/MedicineDetail';
import UpdateStock from './pages/UpdateStock';
import History from './pages/History';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await inventoryService.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      const updated = await inventoryService.markNotificationAsRead(id);
      setNotifications(updated);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleClearAll = async () => {
    try {
      const updated = await inventoryService.clearAllNotifications();
      setNotifications(updated);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  const handleStockUpdated = () => {
    // Refresh notifications when stock updates are recorded
    fetchNotifications();
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        
        {/* Mobile Header Top Bar (Responsive menu trigger) */}
        <div className="mobile-top-bar">
          <button 
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            title="Open navigation menu"
          >
            <Menu size={24} />
          </button>
          <span className="mobile-title">CREVA HEALTH</span>
          <div style={{ width: '24px' }} /> {/* Spacer to center title */}
        </div>

        {/* Navigation Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />

        {/* Main Work Area */}
        <div className="main-layout">
          {/* Global Header */}
          <Header 
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onClearAll={handleClearAll}
          />

          {/* Main Content Area */}
          <main className="content-area">
            <Routes>
              {/* Default Redirect to Dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Core Feature Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              
              <Route path="/inventory" element={<Inventory />} />
              
              <Route path="/inventory/:id" element={<MedicineDetail />} />
              
              <Route path="/inventory/update" element={<UpdateStock onStockUpdated={handleStockUpdated} />} />
              
              <Route path="/history" element={<History />} />
              
              {/* Catch-all Redirect to Dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
