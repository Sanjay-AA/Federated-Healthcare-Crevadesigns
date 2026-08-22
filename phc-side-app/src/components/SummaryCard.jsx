import React from 'react';

const SummaryCard = ({ title, value, subtext, icon: Icon, theme = 'teal' }) => {
  // Theme color maps to css class
  const themeClass = `icon-${theme}`;

  return (
    <div className="summary-card">
      <div className="summary-card-info">
        <span className="summary-card-title">{title}</span>
        <span className="summary-card-value">{value}</span>
        <span className="summary-card-subtext">{subtext}</span>
      </div>
      <div className={`summary-card-icon ${themeClass}`}>
        <Icon size={22} />
      </div>
    </div>
  );
};

export default SummaryCard;
