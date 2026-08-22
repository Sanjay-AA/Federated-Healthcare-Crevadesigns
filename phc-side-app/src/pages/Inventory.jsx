import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Edit2, Grid, List, MapPin, Tag } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/EmptyState';

const Inventory = () => {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table'); // table | grid

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const data = await inventoryService.getMedicines();
        setMedicines(data);
      } catch (err) {
        console.error("Failed to load inventory list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, []);

  if (loading) {
    return <LoadingState message="Loading PHC inventory listing..." />;
  }

  // Get unique categories for dropdown filter
  const categories = ['All', ...new Set(medicines.map(m => m.category).filter(Boolean))];

  // Filter medicines
  const filteredMedicines = medicines.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          med.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          med.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          med.shelfLocation?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
                          med.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesCategory = categoryFilter === 'All' || 
                            med.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="inventory-page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">PHC Inventory</h1>
          <p className="page-subtitle">Detailed listing of tracked medicines and shelf mappings.</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/inventory/update')}
        >
          + Record Stock Count
        </button>
      </div>

      {/* Main card containing controls & content */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Medicine Catalog ({filteredMedicines.length} Medicines)</h3>
          
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button 
              onClick={() => setViewMode('table')}
              style={{ 
                padding: '6px 12px', 
                background: viewMode === 'table' ? 'var(--primary-light)' : 'white',
                color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Table view"
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              style={{ 
                padding: '6px 12px', 
                background: viewMode === 'grid' ? 'var(--primary-light)' : 'white',
                color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Grid view"
            >
              <Grid size={16} />
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Filtering Controls */}
          <div className="table-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div className="search-wrapper" style={{ flex: '1 1 300px' }}>
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search by name, ID, category or rack..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '0 0 auto' }}>
              {/* Category selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
                <select 
                  className="form-select" 
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Status selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                <select 
                  className="form-select" 
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Stocks</option>
                  <option value="Healthy">Healthy</option>
                  <option value="Low">Low Stock</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Render content based on view mode */}
          {filteredMedicines.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No medicines found matching the search criteria or filters.
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine Details</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Safety Stock</th>
                    <th>Status</th>
                    <th>Rack Location</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((med) => (
                    <tr key={med.id}>
                      <td>
                        <div 
                          className="med-name-cell"
                          onClick={() => navigate(`/inventory/${med.id}`)}
                        >
                          {med.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>ID: {med.id}</div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          <Tag size={12} /> {med.category || 'General'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{med.currentStock}</span>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '4px' }}>{med.unit}</span>
                      </td>
                      <td>{med.safetyStock} {med.unit}</td>
                      <td>
                        <StatusBadge status={med.status} />
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                          <MapPin size={12} style={{ color: '#0ea5e9' }} /> {med.shelfLocation || 'Unassigned'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="action-link-btn"
                            onClick={() => navigate(`/inventory/${med.id}`)}
                          >
                            <Eye size={14} /> View
                          </button>
                          <button 
                            className="action-link-btn"
                            onClick={() => navigate(`/inventory/update?medicineId=${med.id}`)}
                          >
                            <Edit2 size={14} /> Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* GRID VIEW */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {filteredMedicines.map((med) => (
                <div 
                  key={med.id} 
                  className="card" 
                  style={{ margin: 0, padding: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '210px' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 
                        style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}
                        onClick={() => navigate(`/inventory/${med.id}`)}
                      >
                        {med.name}
                      </h4>
                      <StatusBadge status={med.status} />
                    </div>
                    
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>ID: {med.id}</p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '14px', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                        <Tag size={12} /> {med.category || 'General'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                        <MapPin size={12} style={{ color: '#0ea5e9' }} /> {med.shelfLocation || 'Unassigned'}
                      </span>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Stock</span>
                        <span style={{ fontSize: '16px', fontWeight: 700 }}>{med.currentStock}</span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '2px' }}>{med.unit}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Safety Stock</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>{med.safetyStock}</span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '2px' }}>{med.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => navigate(`/inventory/${med.id}`)}
                    >
                      <Eye size={14} /> Details
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1, padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => navigate(`/inventory/update?medicineId=${med.id}`)}
                    >
                      <Edit2 size={14} /> Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
