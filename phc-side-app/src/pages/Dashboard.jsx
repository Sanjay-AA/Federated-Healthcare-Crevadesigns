import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pill, AlertTriangle, AlertOctagon, Clock, Search, Eye, Edit2, CheckCircle2 } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import SummaryCard from '../components/SummaryCard';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/EmptyState';

const Dashboard = () => {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const meds = await inventoryService.getMedicines();
        const logs = await inventoryService.getHistory();
        setMedicines(meds);
        setHistory(logs);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState message="Loading dashboard inventory stats..." />;
  }

  // Calculate metrics
  const totalMedicinesCount = medicines.length;
  const lowStockCount = medicines.filter(m => m.status === 'Low').length;
  const criticalStockCount = medicines.filter(m => m.status === 'Critical').length;
  
  // Last updated time is the most recent log's date
  const lastUpdatedTime = history.length > 0 ? history[0].date : "Today, 10:32 AM";

  // Filter medicines
  const filteredMedicines = medicines.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          med.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          med.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
                          med.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="dashboard-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">PHC Dashboard</h1>
        <p className="page-subtitle">Monitor and update your centre's medicine inventory.</p>
      </div>

      {/* Critical Stock Alert Banner if there are any critical stocks */}
      {criticalStockCount > 0 && (
        <div className="dashboard-alert-box" id="dashboard-critical-warning-box">
          <div className="dashboard-alert-info">
            <AlertOctagon size={20} style={{ color: '#dc2626' }} />
            <span className="dashboard-alert-text">
              <strong>Attention Required:</strong> You have {criticalStockCount} medicine{criticalStockCount > 1 ? 's' : ''} in critical stock level. Please check and submit stock updates or request redistribution.
            </span>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setStatusFilter('Critical')}
          >
            Filter Critical
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-grid">
        <SummaryCard 
          title="Total Medicines" 
          value={totalMedicinesCount} 
          subtext="Tracked medicines"
          icon={Pill}
          theme="teal"
        />
        <SummaryCard 
          title="Low Stock" 
          value={lowStockCount} 
          subtext="Require attention"
          icon={AlertTriangle}
          theme="yellow"
        />
        <SummaryCard 
          title="Critical Stock" 
          value={criticalStockCount} 
          subtext="Immediate action required"
          icon={AlertOctagon}
          theme="red"
        />
        <SummaryCard 
          title="Last Updated" 
          value={lastUpdatedTime.replace("Today, ", "").replace("Yesterday, ", "")} 
          subtext={lastUpdatedTime.includes("Today") ? "Today" : lastUpdatedTime.includes("Yesterday") ? "Yesterday" : "Recently"}
          icon={Clock}
          theme="blue"
        />
      </div>

      {/* Inventory Overview Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Inventory Overview</h3>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
            Showing {filteredMedicines.length} of {totalMedicinesCount} items
          </span>
        </div>
        <div className="card-body">
          {/* Controls: Search and Filters */}
          <div className="table-controls">
            <div className="search-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search medicines by name or ID..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filter-group">
              {['All', 'Healthy', 'Low', 'Critical'].map((status) => (
                <button
                  key={status}
                  className={`filter-btn ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="table-responsive">
            {filteredMedicines.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No medicines matched your criteria. Try adjusting your search query or filters.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Current Stock</th>
                    <th>Daily Consumption</th>
                    <th>Safety Stock</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((med) => (
                    <tr key={med.id} id={`med-row-${med.id}`}>
                      {/* Name & ID */}
                      <td>
                        <div 
                          className="med-name-cell"
                          onClick={() => navigate(`/inventory/${med.id}`)}
                        >
                          {med.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          ID: {med.id} | Location: {med.shelfLocation || 'Rack A-1'}
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td>
                        <span style={{ fontWeight: 600 }}>{med.currentStock}</span>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '4px' }}>{med.unit}</span>
                      </td>

                      {/* Consumption */}
                      <td>{med.dailyConsumption} {med.unit}/day</td>

                      {/* Safety Stock */}
                      <td>{med.safetyStock} {med.unit}</td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={med.status} />
                      </td>

                      {/* Last Updated */}
                      <td style={{ fontSize: '13px', color: '#64748b' }}>
                        {med.lastUpdated}
                      </td>

                      {/* Action links */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="action-link-btn"
                            onClick={() => navigate(`/inventory/${med.id}`)}
                            title="View medicine details"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button 
                            className="action-link-btn"
                            onClick={() => navigate(`/inventory/update?medicineId=${med.id}`)}
                            title="Update physical stock count"
                            style={{ color: 'var(--primary)' }}
                          >
                            <Edit2 size={14} /> Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
