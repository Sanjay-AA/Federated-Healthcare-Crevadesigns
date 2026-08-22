import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, LayoutDashboard, Eye } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { LoadingState } from '../components/EmptyState';

const UpdateStock = ({ onStockUpdated }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('medicineId') || '';

  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [selectedMedId, setSelectedMedId] = useState(preSelectedId);
  const [physicalCount, setPhysicalCount] = useState('');
  const [reason, setReason] = useState('Routine stock verification');
  const [notes, setNotes] = useState('');
  
  // Validation & Result State
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const data = await inventoryService.getMedicines();
        setMedicines(data);
        
        // If there's a pre-selected ID, make sure it's valid
        if (preSelectedId && data.some(m => m.id === preSelectedId)) {
          setSelectedMedId(preSelectedId);
        } else if (data.length > 0 && !preSelectedId) {
          // Default to the first medicine in the list
          setSelectedMedId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch medicines for form", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, [preSelectedId]);

  // Find currently selected medicine details
  const selectedMedicine = medicines.find(m => m.id === selectedMedId);

  // Validate the physical stock count
  const validateForm = () => {
    const newErrors = {};
    if (!selectedMedId) {
      newErrors.medicine = "Please select a medicine.";
    }
    
    if (physicalCount === '') {
      newErrors.physicalCount = "Physical stock count is required.";
    } else {
      const countNum = Number(physicalCount);
      if (isNaN(countNum)) {
        newErrors.physicalCount = "Stock count must be a number.";
      } else if (countNum < 0) {
        newErrors.physicalCount = "Stock count cannot be negative.";
      } else if (!Number.isInteger(countNum)) {
        newErrors.physicalCount = "Stock count must be a whole number.";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const res = await inventoryService.updatePhysicalStock(
        selectedMedId, 
        physicalCount, 
        reason, 
        notes
      );
      
      // Store result to show the success banner
      setSuccessResult({
        medicineName: res.medicine.name,
        medicineId: res.medicine.id,
        previousStock: res.history.previousStock,
        newStock: res.history.newStock,
        unit: res.medicine.unit
      });

      // Clear physical count field & notes
      setPhysicalCount('');
      setNotes('');
      setErrors({});

      // Callback to parent layout to trigger notifications refresh instantly!
      if (onStockUpdated) {
        onStockUpdated();
      }

      // Scroll to top to show success banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Failed to update stock", err);
      setErrors({ form: err.message || "An unexpected error occurred during submission." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessResult(null);
    if (medicines.length > 0) {
      setSelectedMedId(medicines[0].id);
    }
    setPhysicalCount('');
    setReason('Routine stock verification');
    setNotes('');
    setErrors({});
  };

  if (loading) {
    return <LoadingState message="Loading update form resources..." />;
  }

  return (
    <div className="update-stock-container" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)}
        className="btn btn-secondary"
        style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Title */}
      <div className="page-header">
        <h1 className="page-title">Update Inventory</h1>
        <p className="page-subtitle">Record the latest physical stock count for your PHC.</p>
      </div>

      {/* Success Notification Banner */}
      {successResult && (
        <div className="alert-banner" id="update-success-banner">
          <CheckCircle2 size={24} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h4 className="alert-banner-title">SUCCESS</h4>
            <p className="alert-banner-desc">
              Inventory update recorded successfully.
            </p>
            <p style={{ fontWeight: 600, marginTop: '6px', fontSize: '13px' }}>
              {successResult.medicineName} (ID: {successResult.medicineId}): {successResult.previousStock} → {successResult.newStock} {successResult.unit}
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                onClick={() => navigate(`/inventory/${successResult.medicineId}`)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff' }}
              >
                <Eye size={12} /> View Details
              </button>
              <button 
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff' }}
              >
                <LayoutDashboard size={12} /> Dashboard
              </button>
              <button 
                onClick={handleResetForm}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={12} /> Update Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Stock Count Record Form</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="card-body">
          {errors.form && (
            <div className="alert-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#fee2e2', color: '#b91c1c', marginBottom: '20px' }}>
              <AlertCircle size={20} />
              <div>
                <strong>Error:</strong> {errors.form}
              </div>
            </div>
          )}

          <div className="form-grid">
            {/* Medicine Select */}
            <div className="form-group col-full">
              <label className="form-label" htmlFor="medicine-select">Medicine</label>
              <select 
                id="medicine-select"
                className="form-select"
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="" disabled>-- Select a Medicine --</option>
                {medicines.map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.name} ({med.id})
                  </option>
                ))}
              </select>
              {errors.medicine && <span className="input-feedback">{errors.medicine}</span>}
            </div>

            {/* Current Stock Display */}
            {selectedMedicine && (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <div style={{ backgroundColor: 'var(--bg-main)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Current Recorded Stock</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px', display: 'block' }}>
                    {selectedMedicine.currentStock} {selectedMedicine.unit}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    Last audited: {selectedMedicine.lastUpdated} | Safety limit: {selectedMedicine.safetyStock} {selectedMedicine.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Physical Stock Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="physical-count-input">Physical Stock Count</label>
              <input 
                id="physical-count-input"
                type="number"
                min="0"
                step="1"
                placeholder="Enter verified quantity..."
                className="form-input"
                value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value)}
                disabled={isSubmitting}
              />
              {errors.physicalCount && <span className="input-feedback">{errors.physicalCount}</span>}
            </div>

            {/* Unit display */}
            <div className="form-group">
              <label className="form-label" htmlFor="unit-display">Unit</label>
              <input 
                id="unit-display"
                type="text" 
                className="form-input" 
                value={selectedMedicine ? selectedMedicine.unit : 'Units'} 
                disabled 
                style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}
              />
            </div>

            {/* Reason Select */}
            <div className="form-group col-full">
              <label className="form-label" htmlFor="reason-select">Reason for Update</label>
              <select 
                id="reason-select"
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="Routine stock verification">Routine stock verification</option>
                <option value="Stock dispensing">Stock dispensing</option>
                <option value="New stock received">New stock received</option>
                <option value="Damaged / Expired goods">Damaged / Expired goods</option>
                <option value="Redistribution transfer">Redistribution transfer</option>
              </select>
            </div>

            {/* Notes */}
            <div className="form-group col-full">
              <label className="form-label" htmlFor="notes-textarea">Notes (Optional)</label>
              <textarea 
                id="notes-textarea"
                placeholder="Include batch numbers, discrepancy explanations, or transfer details..."
                className="form-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/dashboard')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
              id="submit-update-btn"
            >
              {isSubmitting ? 'Recording count...' : 'Submit Stock Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateStock;
