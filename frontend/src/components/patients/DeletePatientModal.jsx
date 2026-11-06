import React, { useState, useEffect } from 'react';
import DashboardIcon from '../ui/DashboardIcons';
import { api } from '../../services/api';

/**
 * DeletePatientModal - Confirmation dialog for safely deleting a patient record
 * Features clear warning, patient identification, dependent records summary,
 * loading state, and double-action confirmation to prevent accidental data loss.
 */
export default function DeletePatientModal({
  isOpen,
  patient,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) {
  const [dependentCounts, setDependentCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!isOpen || !patient?.id) {
      setDependentCounts(null);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;
    setLoadingCounts(true);
    setErrorMessage(null);

    api.getPatientDependentCounts(patient.id)
      .then((res) => {
        if (isMounted && res?.data?.counts) {
          setDependentCounts(res.data.counts);
        }
      })
      .catch((err) => {
        // Non-critical: if endpoint fails, fallback gracefully to patient object props
        console.warn('Could not fetch dependent counts:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoadingCounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, patient?.id]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !patient) return null;

  const handleDelete = async () => {
    setErrorMessage(null);
    try {
      await onConfirmDelete(patient.id);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete patient. Please try again.');
    }
  };

  const hasDependents =
    dependentCounts?.total > 0 ||
    patient.assessment_count > 0 ||
    Boolean(patient.latest_assessment);

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-patient-modal-title"
    >
      <div
        className="modal-content"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-header"
          style={{
            borderBottom: '1px solid #fee2e2',
            background: '#fff5f5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DashboardIcon name="trash" size={18} />
            </div>
            <h3 id="delete-patient-modal-title" style={{ color: '#991b1b', margin: 0, fontSize: '1.1rem' }}>
              Delete Patient Record
            </h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close dialog"
            style={{ color: '#991b1b' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ gap: '1.15rem' }}>
          {errorMessage && (
            <div
              className="toast-banner toast-error"
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
              }}
            >
              {errorMessage}
            </div>
          )}

          <div className="delete-warning-box">
            <strong>Warning: Permanent Action</strong>
            <p style={{ margin: '0.4rem 0 0 0' }}>
              Are you sure you want to permanently delete this patient? This action cannot be undone and will remove all medical history.
            </p>
          </div>

          <div
            className="delete-patient-summary"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#1e293b' }}>
                {patient.name}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'rgba(23, 77, 60, 0.08)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                {patient.patient_code}
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: '0.75rem' }}>
              <span>Age: <strong>{patient.age} yrs</strong></span>
              <span>•</span>
              <span style={{ textTransform: 'capitalize' }}>Sex: <strong>{patient.sex}</strong></span>
              {patient.occupation && (
                <>
                  <span>•</span>
                  <span>{patient.occupation}</span>
                </>
              )}
            </div>

            {/* Dependent Records Info */}
            {hasDependents && (
              <div
                style={{
                  marginTop: '0.4rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed #cbd5e1',
                  fontSize: '0.78rem',
                  color: '#475569',
                }}
              >
                <span style={{ fontWeight: 600, color: '#b91c1c' }}>Associated records to be purged: </span>
                {loadingCounts ? (
                  <span>Checking clinical records...</span>
                ) : dependentCounts ? (
                  <span>
                    {dependentCounts.assessments} assessment{dependentCounts.assessments !== 1 ? 's' : ''}
                    {dependentCounts.mealPlans > 0 && `, ${dependentCounts.mealPlans} meal plan${dependentCounts.mealPlans !== 1 ? 's' : ''}`}
                    {dependentCounts.dietPlans > 0 && `, ${dependentCounts.dietPlans} 7-day diet plan${dependentCounts.dietPlans !== 1 ? 's' : ''}`}
                    {dependentCounts.labReports > 0 && `, ${dependentCounts.labReports} lab report${dependentCounts.labReports !== 1 ? 's' : ''}`}
                  </span>
                ) : (
                  <span>
                    {patient.assessment_count || 1} assessment record(s) and generated diet plans
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ background: '#f8fafc' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <DashboardIcon name="refresh-cw" size={14} className="ayur-spin" />
                <span>Deleting Patient...</span>
              </>
            ) : (
              <>
                <DashboardIcon name="trash" size={14} />
                <span>Delete Patient</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
