import React from 'react';

const StatusBadge = ({ status }) => {
  let badgeClass = 'status-healthy';
  let label = 'Healthy';

  switch (status?.toLowerCase()) {
    case 'low':
    case 'low stock':
      badgeClass = 'status-low';
      label = 'Low Stock';
      break;
    case 'critical':
      badgeClass = 'status-critical';
      label = 'Critical';
      break;
    default:
      badgeClass = 'status-healthy';
      label = 'Healthy';
  }

  return (
    <span className={`status-badge ${badgeClass}`} id={`status-${status?.toLowerCase()}`}>
      ● {label}
    </span>
  );
};

export default StatusBadge;
