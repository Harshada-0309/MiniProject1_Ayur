import React from 'react';
import DashboardIcon from '../ui/DashboardIcons';

export default function AppSidebar({
  currentRoute,
  onRouteChange,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  patientCount = 0,
  dietitian,
  onOpenProfileModal,
  onLogout,
}) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      iconName: 'layout-dashboard',
      badge: null,
    },
    {
      id: 'patients',
      label: 'Patients',
      iconName: 'users-round',
      badge: patientCount > 0 ? patientCount : null,
      badgeVariant: 'count',
    },
    {
      id: 'clinical',
      label: 'Assessments',
      iconName: 'clipboard-check',
      badge: null,
    },
    {
      id: 'meal-planner',
      label: 'Meal Planner',
      iconName: 'utensils',
      badge: null,
    },
    {
      id: 'knowledge',
      label: 'Knowledge Base',
      iconName: 'book-open',
      badge: 'RAG',
      badgeVariant: 'rag',
    },
    {
      id: 'reports',
      label: 'Reports',
      iconName: 'file-chart-column',
      badge: null,
    },
  ];

  const initials = dietitian?.name
    ? dietitian.name.replace(/^(Dr\.?\s*)/i, '').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="ayur-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`ayur-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Clinical Portal Navigation"
      >
        {/* Brand Header */}
        <div className="ayur-sidebar-header">
          <div
            className="ayur-brand-link"
            onClick={() => (collapsed ? onToggleCollapse() : onRouteChange('dashboard'))}
            title={collapsed ? 'Click to expand sidebar' : 'AyurDiet Clinical Dashboard'}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                collapsed ? onToggleCollapse() : onRouteChange('dashboard');
              }
            }}
          >
            <img
              src="/images/ayurdiet-emblem.png"
              alt="AyurDiet Emblem"
              className="ayur-sidebar-emblem"
            />
            {!collapsed && (
              <div className="ayur-brand-text">
                <span className="ayur-brand-title">AyurDiet</span>
                <span className="ayur-brand-subtitle">Clinical Portal</span>
              </div>
            )}
          </div>

          <div className="ayur-sidebar-header-actions">
            {mobileOpen && (
              <button
                type="button"
                className="ayur-sidebar-close-mobile-btn"
                onClick={onCloseMobile}
                aria-label="Close navigation drawer"
              >
                <DashboardIcon name="x" size={18} />
              </button>
            )}

            <button
              type="button"
              className="ayur-sidebar-collapse-btn"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <DashboardIcon
                name={collapsed ? 'chevron-right' : 'chevron-left'}
                size={16}
              />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="ayur-sidebar-nav">
          {!collapsed && <div className="ayur-nav-section-label">Core Clinical Suite</div>}

          {navItems.map((item) => {
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`ayur-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onRouteChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="ayur-nav-icon">
                  <DashboardIcon name={item.iconName} size={18} />
                </span>
                {!collapsed && (
                  <>
                    <span className="ayur-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`ayur-nav-badge ${item.badgeVariant ? `badge-${item.badgeVariant}` : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Dietitian Profile Footer */}
        <div className="ayur-sidebar-footer">
          <div
            className="ayur-dietitian-card"
            onClick={onOpenProfileModal}
            style={{ cursor: onOpenProfileModal ? 'pointer' : 'default' }}
            title={onOpenProfileModal ? 'View / Edit Dietitian Profile' : undefined}
          >
            <div className="ayur-avatar" style={{ overflow: 'hidden' }}>
              {dietitian?.photo_url ? (
                <img
                  src={dietitian.photo_url}
                  alt={dietitian?.name || 'Practitioner'}
                  className="ayur-avatar-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                />
              ) : (
                initials
              )}
            </div>
            {!collapsed && (
              <div className="ayur-dietitian-info">
                <span className="ayur-dietitian-name">{dietitian?.name || 'Dr. Vaidya'}</span>
                <span className="ayur-dietitian-role">{dietitian?.role || 'Chief Clinical Dietitian'}</span>
              </div>
            )}
            {!collapsed && onLogout && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                className="ayur-sidebar-logout-btn"
                title="Log out from clinical workspace"
                aria-label="Log out from clinical workspace"
              >
                <DashboardIcon name="log-out" size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
