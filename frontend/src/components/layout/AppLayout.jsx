import React, { useState } from 'react';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import '../../styles/teal-tokens.css';
import '../../styles/premium-dashboard.css';
import '../../styles/hire-help-theme.css';

export default function AppLayout({
  children,
  currentRoute,
  onRouteChange,
  title,
  subtitle,
  activePatient,
  onOpenNewPatientModal,
  patientCount = 0,
  dietitian,
  onOpenProfileModal,
  onLogout,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="ayur-app-shell">
      <AppSidebar
        currentRoute={currentRoute}
        onRouteChange={onRouteChange}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        patientCount={patientCount}
        dietitian={dietitian}
        onOpenProfileModal={onOpenProfileModal}
        onLogout={onLogout}
      />

      <div className="ayur-main-layout">
        <AppHeader
          title={title}
          subtitle={subtitle}
          activePatient={activePatient}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onOpenNewPatientModal={onOpenNewPatientModal}
          dietitian={dietitian}
          onOpenProfileModal={onOpenProfileModal}
          onLogout={onLogout}
        />

        <main className="ayur-content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
