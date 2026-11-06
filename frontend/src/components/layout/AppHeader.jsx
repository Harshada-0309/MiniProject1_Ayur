import React, { useState, useRef, useEffect } from 'react';
import DashboardIcon from '../ui/DashboardIcons';
import ThemeToggle from '../ui/ThemeToggle';

export default function AppHeader({
  title,
  subtitle,
  activePatient,
  onOpenMobileMenu,
  onOpenNewPatientModal,
  dietitian,
  onOpenProfileModal,
  onLogout,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Reset image error state whenever dietitian's photo URL changes
  useEffect(() => {
    setImageError(false);
  }, [dietitian?.photo_url]);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showSignOutConfirm) {
          setShowSignOutConfirm(false);
        } else if (profileOpen) {
          setProfileOpen(false);
          triggerRef.current?.focus();
        }
      }
    };

    if (profileOpen || showSignOutConfirm) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen, showSignOutConfirm]);

  const initials = dietitian?.name
    ? dietitian.name.replace(/^(Dr\.?\s*)/i, '').slice(0, 2).toUpperCase()
    : 'DR';

  const handleOpenProfile = () => {
    setProfileOpen(false);
    if (onOpenProfileModal) {
      onOpenProfileModal();
    }
  };

  const handleRequestSignOut = () => {
    setProfileOpen(false);
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = () => {
    setShowSignOutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <>
      <header className="ayur-header">
        <div className="ayur-header-left">
          <button
            type="button"
            className="ayur-mobile-menu-btn"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation drawer"
          >
            <DashboardIcon name="menu" size={20} />
          </button>

          <div className="ayur-page-title-group">
            <h1 className="ayur-page-title">{title}</h1>
            {subtitle && <span className="ayur-page-subtitle">{subtitle}</span>}
          </div>
        </div>

        <div className="ayur-header-right">
          {activePatient && (
            <div className="ayur-active-patient-pill" title={`Active: ${activePatient.name}`}>
              <span className="ayur-active-dot" aria-hidden="true" />
              <span className="ayur-active-text">
                Active: <strong>{activePatient.name}</strong>{' '}
                <span className="ayur-active-code">({activePatient.patient_code})</span>
              </span>
            </div>
          )}

          <div className="ayur-date-chip">
            <DashboardIcon name="calendar-days" size={14} className="ayur-date-icon" />
            <span>{formattedDate}</span>
          </div>

          <ThemeToggle />

          {onOpenNewPatientModal && (
            <button
              type="button"
              className="btn-ayur-primary ayur-header-new-btn"
              onClick={onOpenNewPatientModal}
              aria-label="Register new patient"
            >
              <DashboardIcon name="user-plus" size={16} />
              <span>New Patient</span>
            </button>
          )}

          {/* Dietitian Profile Dropdown */}
          <div className="ayur-profile-menu-container" ref={dropdownRef}>
            <button
              ref={triggerRef}
              type="button"
              className={`ayur-profile-trigger ${profileOpen ? 'open' : ''}`}
              onClick={() => setProfileOpen(!profileOpen)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label={`Practitioner profile for ${dietitian?.name || 'Dr. Vaidya'}`}
            >
              <div className="ayur-profile-avatar" style={{ overflow: 'hidden' }}>
                {dietitian?.photo_url && !imageError ? (
                  <img
                    src={dietitian.photo_url}
                    alt={dietitian?.name || 'Practitioner'}
                    className="ayur-avatar-img"
                    onError={() => setImageError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                  />
                ) : (
                  <span className="ayur-avatar-initials">{initials}</span>
                )}
              </div>
              <span className="ayur-profile-name">
                {dietitian?.name || 'Dr. Vaidya'}
              </span>
              <DashboardIcon
                name="chevron-down"
                size={14}
                className={`ayur-profile-chevron ${profileOpen ? 'rotate' : ''}`}
              />
            </button>

            {profileOpen && (
              <div className="ayur-profile-dropdown" role="menu" aria-label="Practitioner profile menu">
                {/* Clickable Profile Header Card */}
                <div
                  className="ayur-dropdown-user-info ayur-dropdown-user-info-clickable"
                  onClick={handleOpenProfile}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenProfile();
                    }
                  }}
                  title="Click to view and edit profile"
                >
                  <div className="ayur-dropdown-avatar" style={{ overflow: 'hidden' }}>
                    {dietitian?.photo_url && !imageError ? (
                      <img
                        src={dietitian.photo_url}
                        alt={dietitian?.name || 'Practitioner'}
                        className="ayur-avatar-img"
                        onError={() => setImageError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                      />
                    ) : (
                      <span className="ayur-avatar-initials">{initials}</span>
                    )}
                  </div>
                  <div className="ayur-dropdown-meta">
                    <span className="ayur-dropdown-name">{dietitian?.name || 'Dr. Vaidya'}</span>
                    <span className="ayur-dropdown-role">{dietitian?.role || 'Clinical Dietitian'}</span>
                    {dietitian?.email && <span className="ayur-dropdown-email">{dietitian.email}</span>}
                  </div>
                </div>

                <div className="ayur-dropdown-divider" />

                <button
                  type="button"
                  className="ayur-dropdown-item-btn"
                  role="menuitem"
                  onClick={handleOpenProfile}
                >
                  <DashboardIcon name="user-round" size={16} />
                  <span>View & Edit Profile</span>
                </button>

                <div className="ayur-dropdown-divider" />

                <div className="ayur-dropdown-theme-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.85rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--color-slate-muted)' }}>Theme</span>
                  <ThemeToggle compact={false} />
                </div>

                <div className="ayur-dropdown-divider" />

                {onLogout && (
                  <button
                    type="button"
                    className="ayur-dropdown-logout-btn"
                    role="menuitem"
                    onClick={handleRequestSignOut}
                  >
                    <DashboardIcon name="log-out" size={16} />
                    <span>Sign Out of Portal</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sign Out Confirmation Dialog */}
      {showSignOutConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowSignOutConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-modal-title"
        >
          <div
            className="modal-content ayur-signout-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', padding: 0 }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <DashboardIcon name="log-out" size={18} />
                </div>
                <div>
                  <h3 id="signout-modal-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-deep-slate)' }}>
                    Sign Out of Portal
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-slate-muted)' }}>
                    End Clinical Session
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSignOutConfirm(false)}
                aria-label="Close dialog"
              >
                <DashboardIcon name="x" size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', color: 'var(--color-deep-slate)', lineHeight: 1.5 }}>
                Are you sure you want to sign out, <strong>{dietitian?.name || 'Doctor'}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-slate-muted)', lineHeight: 1.5 }}>
                Your clinical session will be securely ended. Any unsaved patient notes or assessment drafts should be saved before leaving.
              </p>
            </div>

            <div className="modal-footer" style={{
              padding: '0.9rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: 'var(--color-pearl-white)',
            }}>
              <button
                type="button"
                className="btn-ayur-outline"
                onClick={() => setShowSignOutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-ayur-danger"
                onClick={handleConfirmSignOut}
                style={{
                  background: '#dc2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'background-color var(--duration-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
              >
                <DashboardIcon name="log-out" size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
