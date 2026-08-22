import React from 'react';
import { PackageOpen, AlertCircle, RefreshCw } from 'lucide-react';

export const EmptyState = ({ title = "No items found", subtitle = "Try refining your search or filter options.", icon: Icon = PackageOpen }) => {
  return (
    <div className="empty-container">
      <div className="empty-icon">
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-subtitle">{subtitle}</p>
    </div>
  );
};

export const LoadingState = ({ message = "Loading information..." }) => {
  return (
    <div className="loading-container">
      <div className="spinner" />
      <p style={{ color: '#475569', fontSize: '14px', fontWeight: 500 }}>{message}</p>
    </div>
  );
};

export const ErrorState = ({ title = "Something went wrong", message = "Unable to load data. Please check your connection.", onRetry }) => {
  return (
    <div className="empty-container" style={{ borderColor: 'var(--status-critical-border)', backgroundColor: '#fff8f8' }}>
      <div className="empty-icon" style={{ color: 'var(--status-critical-text)' }}>
        <AlertCircle size={48} strokeWidth={1.5} />
      </div>
      <h3 className="empty-title" style={{ color: '#b91c1c' }}>{title}</h3>
      <p className="empty-subtitle" style={{ color: '#7f1d1d' }}>{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry} 
          className="btn btn-secondary" 
          style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
};
