import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Calendar, ClipboardList, MapPin, Tag, Activity } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import StatusBadge from '../components/StatusBadge';
import { LoadingState, EmptyState } from '../components/EmptyState';

const MedicineDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medicine, setMedicine] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const medData = await inventoryService.getMedicineById(id);
        const historyData = await inventoryService.getHistory();
        
        setMedicine(medData);
        // Filter history logs that match this specific medicine
        const filteredHistory = historyData.filter(log => log.medicineId === id);
        setHistory(filteredHistory);
      } catch (err) {
        console.error("Failed to load medicine details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return <LoadingState message="Fetching medicine card details..." />;
  }

  if (!medicine) {
    return (
      <EmptyState 
        title="Medicine Not Found" 
        subtitle={`We couldn't locate a medicine with ID: ${id}. Please double check the ID.`}
      />
    );
  }

  // Combine default activity in mock and actual audit logs for a richer timeline
  const combinedActivities = [];
  
  // Add actual audit logs
  history.forEach(log => {
    combinedActivities.push({
      date: log.date,
      event: log.reason,
      detail: `${log.previousStock} → ${log.newStock} ${medicine.unit} (${log.notes || 'No notes'})`,
      type: log.change > 0 ? 'receive' : 'update',
      timestamp: new Date(log.date.includes("Today") ? Date.now() : log.date.includes("Yesterday") ? Date.now() - 86400000 : Date.now() - 172800000).getTime()
    });
  });

  // Add mock design activity items (if they don't overlap)
  if (medicine.recentActivity) {
    medicine.recentActivity.forEach((act, index) => {
      combinedActivities.push({
        date: act.date,
        event: act.event,
        detail: act.detail,
        type: act.type,
        timestamp: Date.now() - (index + 2) * 86400000 // simulate ordering
      });
    });
  }

  return (
    <div className="medicine-detail-container">
      {/* Back link */}
      <button 
        onClick={() => navigate('/inventory')}
        className="btn btn-secondary"
        style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px' }}
      >
        <ArrowLeft size={16} /> Back to Inventory
      </button>

      {/* Detail Grid */}
      <div className="detail-grid">
        {/* Left Column: Info card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Info Card */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Medicine ID: {medicine.id}</span>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{medicine.name}</h2>
              </div>
              <StatusBadge status={medicine.status} />
            </div>
            
            <div className="card-body">
              {/* Stats Block */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '16px', 
                  backgroundColor: 'var(--primary-light)', 
                  padding: '20px', 
                  borderRadius: 'var(--radius-lg)', 
                  marginBottom: '28px',
                  border: '1px solid var(--status-healthy-border)'
                }}
              >
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>Current Stock</span>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary-hover)' }}>{medicine.currentStock}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>{medicine.unit}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Daily Consumption</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{medicine.dailyConsumption}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>{medicine.unit}/day</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Safety Stock Threshold</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{medicine.safetyStock}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>{medicine.unit}</span>
                </div>
              </div>

              {/* General details */}
              <h4 style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>Technical Profile</h4>
              
              <div className="info-grid" style={{ marginBottom: '24px' }}>
                <div className="info-item">
                  <span className="info-label">Category</span>
                  <span className="info-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={14} style={{ color: 'var(--text-muted)' }} /> {medicine.category || 'General'}
                  </span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Shelf Location</span>
                  <span className="info-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} style={{ color: '#0ea5e9' }} /> {medicine.shelfLocation || 'Rack A-1'}
                  </span>
                </div>

                <div className="info-item">
                  <span className="info-label">Unit Specification</span>
                  <span className="info-val">{medicine.unit}</span>
                </div>

                <div className="info-item">
                  <span className="info-label">Last Audit Date</span>
                  <span className="info-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} /> {medicine.lastUpdated}
                  </span>
                </div>
              </div>

              {medicine.description && (
                <>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '12px' }}>Description / Indications</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{medicine.description}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Recent Activity timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Direct Stock Update Link Box */}
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">Manage Stock</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => navigate(`/inventory/update?medicineId=${medicine.id}`)}
              >
                <Edit2 size={16} /> Update Physical Stock
              </button>
            </div>
          </div>

          {/* Activity Timeline Card */}
          <div className="card" style={{ margin: 0, flex: 1 }}>
            <div className="card-header" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Activity size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="card-title">Recent Activity</h3>
            </div>
            <div className="card-body">
              {combinedActivities.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No recorded activity for this medicine.</p>
              ) : (
                <div className="activity-timeline">
                  {combinedActivities.map((act, index) => (
                    <div className="activity-item" key={index}>
                      <span className={`activity-dot dot-${act.type}`} />
                      <div className="activity-time-label">{act.date}</div>
                      <div className="activity-text">{act.event}</div>
                      <div className="activity-detail">{act.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineDetail;
