import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Clock, Filter, Eye, ArrowUpDown, Trash2 } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { LoadingState } from '../components/EmptyState';

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); // newest | oldest

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await inventoryService.getHistory();
        setHistory(data);
      } catch (err) {
        console.error("Failed to load history logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) {
    return <LoadingState message="Retrieving transaction audit logs..." />;
  }

  // Get unique reasons for filter dropdown
  const reasons = ['All', ...new Set(history.map(item => item.reason).filter(Boolean))];

  // Filter logs
  const filteredHistory = history.filter(item => {
    return reasonFilter === 'All' || item.reason === reasonFilter;
  });

  // Sort logs
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    // Basic date parsing (Today / Yesterday mock strings or standard dates)
    // In Phase 1 we can trust array ordering since mockData is ordered and new ones are prepended,
    // but we can toggle reversing the array to sort.
    if (sortOrder === 'newest') {
      return 0; // already in reverse chronological order (newest first)
    } else {
      return 1; // reverses chronology (oldest first)
    }
  });

  if (sortOrder === 'oldest') {
    sortedHistory.reverse();
  }

  const formatChange = (change, unit) => {
    if (change > 0) {
      return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>+{change}</span>;
    } else if (change < 0) {
      return <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{change}</span>;
    } else {
      return <span style={{ color: '#64748b' }}>--</span>;
    }
  };

  const handleReset = async () => {
    if (window.confirm("This will reset all inventory levels and history to their initial mock data. Proceed?")) {
      setLoading(true);
      await inventoryService.resetToMock();
      const logs = await inventoryService.getHistory();
      setHistory(logs);
      setLoading(false);
      window.location.reload();
    }
  };

  return (
    <div className="history-page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Inventory Update History</h1>
          <p className="page-subtitle">Review recent stock changes recorded by this PHC.</p>
        </div>
        
        {/* Reset button for easy testing */}
        <button 
          className="btn btn-secondary"
          onClick={handleReset}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}
          title="Reset database to mock defaults"
        >
          <Trash2 size={14} /> Reset Database
        </button>
      </div>

      {/* Main card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HistoryIcon size={16} style={{ color: 'var(--primary)' }} /> Audit Log Trail ({sortedHistory.length} entries)
          </h3>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filter by reason */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Reason:</span>
              <select 
                className="form-select" 
                style={{ padding: '4px 10px', fontSize: '13px' }}
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
              >
                {reasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Sort order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Sort:</span>
              <select 
                className="form-select" 
                style={{ padding: '4px 10px', fontSize: '13px' }}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-body">
          {sortedHistory.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No history records found matching current filter.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Medicine</th>
                    <th>Previous Stock</th>
                    <th>New Stock</th>
                    <th>Change</th>
                    <th>Reason</th>
                    <th>Updated By</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistory.map((item) => (
                    <tr key={item.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: 'none', height: '100%', padding: '16px 20px' }}>
                        <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{item.date}</span>
                      </td>
                      <td style={{ borderBottom: '1px solid var(--border)' }}>
                        <div 
                          className="med-name-cell"
                          onClick={() => navigate(`/inventory/${item.medicineId}`)}
                        >
                          {item.medicineName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>ID: {item.medicineId}</div>
                      </td>
                      <td>
                        {item.previousStock}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.newStock}</span>
                      </td>
                      <td>
                        {formatChange(item.change)}
                      </td>
                      <td>
                        <span 
                          style={{ 
                            display: 'inline-block',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 500
                          }}
                        >
                          {item.reason}
                        </span>
                        {item.notes && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                            Note: "{item.notes}"
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '13px', color: '#64748b' }}>
                        {item.updatedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
