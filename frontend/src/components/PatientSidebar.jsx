import React from 'react';
import DashboardIcon from './ui/DashboardIcons';

export default function PatientSidebar({
  patients,
  activePatient,
  onSelectPatient,
  onOpenNewPatientModal,
  onOpenKnowledgeBase,
  searchQuery,
  onSearchChange,
  loading,
  onRequestDeletePatient,
}) {
  return (
    <aside className="patient-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h2 className="sidebar-heading">Patients ({patients.length})</h2>
          <button className="btn-new-patient" onClick={onOpenNewPatientModal}>
            <DashboardIcon name="plus" size={14} /> New Patient
          </button>
        </div>

        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, ID, phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="patient-list">
        {loading && <div style={{ padding: '1rem', textAlign: 'center', color: '#788d84' }}>Loading patients...</div>}

        {!loading && patients.length === 0 && (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#788d84', fontSize: '0.85rem' }}>
            No patients found matching "{searchQuery}".
          </div>
        )}

        {patients.map((patient) => {
          const isActive = activePatient && activePatient.id === patient.id;
          const hasAssessment = patient.latest_assessment;

          return (
            <div
              key={patient.id}
              className={`patient-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectPatient(patient)}
            >
              <div className="patient-item-top">
                <span className="patient-item-name">{patient.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="patient-item-code">{patient.patient_code}</span>
                  {onRequestDeletePatient && (
                    <button
                      type="button"
                      className="patient-item-delete-btn"
                      title={`Delete ${patient.name}`}
                      aria-label={`Delete patient ${patient.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestDeletePatient(patient);
                      }}
                    >
                      <DashboardIcon name="trash" size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="patient-item-meta">
                <span>{patient.age} yrs</span>
                <span>•</span>
                <span style={{ textTransform: 'capitalize' }}>{patient.sex}</span>
                {patient.occupation && (
                  <>
                    <span>•</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                      {patient.occupation}
                    </span>
                  </>
                )}
              </div>

              {hasAssessment ? (
                <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span className="patient-item-badge" style={{ background: '#edf7f3', color: '#174d3c' }}>
                    {patient.latest_assessment.prakriti || 'Assessed'}
                  </span>
                  {patient.latest_assessment.diet_goal && (
                    <span className="patient-item-badge" style={{ background: '#fef7ed', color: '#b45309' }}>
                      {patient.latest_assessment.diet_goal.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              ) : (
                <span
                  className="patient-item-badge"
                  style={{ background: '#f3f4f6', color: '#6b7280', marginTop: '0.35rem' }}
                >
                  Pending Assessment
                </span>
              )}
            </div>
          );
        })}
      </div>

      {onOpenKnowledgeBase && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-light)', backgroundColor: '#fcfdfc' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.84rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 0.75rem' }}
            onClick={onOpenKnowledgeBase}
          >
            <DashboardIcon name="book-open" size={15} /> Open Knowledge Base
          </button>
        </div>
      )}
    </aside>
  );
}
