import React from 'react';
import DashboardIcon from './ui/DashboardIcons';

export default function Header({ activePatient, currentWorkspace = 'clinical', onWorkspaceChange }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="top-header">
      <div className="brand-section">
        <img
          src="/images/ayurdiet-emblem.png"
          alt="AyurDiet Emblem"
          style={{ width: '38px', height: '38px', objectFit: 'contain' }}
        />
        <div>
          <div className="brand-title">
            AyurDiet
            <span className="brand-subtitle">Dietitian Portal</span>
          </div>
        </div>
      </div>

      {/* Primary Workspace Navigation */}
      <nav className="header-nav-tabs" aria-label="Workspace Navigation">
        <button
          type="button"
          className={`header-nav-tab ${currentWorkspace === 'clinical' ? 'active' : ''}`}
          onClick={() => onWorkspaceChange && onWorkspaceChange('clinical')}
        >
          <DashboardIcon name="clipboard-check" size={16} /> Patient Workspace
        </button>
        <button
          type="button"
          className={`header-nav-tab ${currentWorkspace === 'knowledge' ? 'active' : ''}`}
          onClick={() => onWorkspaceChange && onWorkspaceChange('knowledge')}
        >
          <DashboardIcon name="book-open" size={16} /> Knowledge Base
        </button>
      </nav>

      <div className="header-meta">
        {activePatient && (
          <div style={{ fontSize: '0.85rem', color: '#ecd0a2', fontWeight: 500 }}>
            Active: <strong>{activePatient.name}</strong> ({activePatient.patient_code})
          </div>
        )}
        <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>{today}</div>
        <div className="dietitian-badge">
          <span className="dietitian-dot" />
          <span>Dietitian Workspace</span>
        </div>
      </div>
    </header>
  );
}
