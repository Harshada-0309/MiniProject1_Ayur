import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import DashboardIcon from './DashboardIcons';

export default function ThemeToggle({
  className = '',
  style = {},
  showLabel = true,
  compact = false,
}) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`ayur-theme-toggle-btn ${isDark ? 'is-dark' : 'is-light'} ${compact ? 'compact' : ''} ${className}`.trim()}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={style}
    >
      <span className="ayur-theme-toggle-icon" aria-hidden="true">
        {isDark ? (
          <DashboardIcon name="sun" size={16} className="ayur-sun-icon" />
        ) : (
          <DashboardIcon name="moon" size={16} className="ayur-moon-icon" />
        )}
      </span>
      {showLabel && (
        <span className="ayur-theme-toggle-label">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
