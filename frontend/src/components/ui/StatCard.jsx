import React from 'react';
import DashboardIcon from './DashboardIcons';

export default function StatCard({
  label,
  value,
  hint,
  icon,
  onClick,
  style,
}) {
  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <DashboardIcon name={icon} size={22} strokeWidth={2} />;
    }
    return icon;
  };

  return (
    <div
      className="ayur-stat-card"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={style}
    >
      <div className="ayur-stat-info">
        <span className="ayur-stat-label">{label}</span>
        <span className="ayur-stat-value">{value}</span>
        {hint && <span className="ayur-stat-hint">{hint}</span>}
      </div>
      {icon && (
        <div className="ayur-stat-icon-wrapper">
          {renderIcon()}
        </div>
      )}
    </div>
  );
}
