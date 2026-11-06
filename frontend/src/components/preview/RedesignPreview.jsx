import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '../layout/AppLayout';
import DashboardView from '../dashboard/DashboardView';
import PatientDirectoryView from '../patients/PatientDirectoryView';
import LoginView from '../auth/LoginView';
import DietPlanPrintView from '../reports/DietPlanPrintView';

// Reuse existing core clinical components
import PatientSidebar from '../PatientSidebar';
import AssessmentForm from '../AssessmentForm';
import NewPatientModal from '../NewPatientModal';
import ClinicalLabModal from '../ClinicalLabModal';
import RAGKnowledgeViewer from '../RAGKnowledgeViewer';

import { api } from '../../services/api';
import '../../styles/teal-tokens.css';
import '../../styles/premium-dashboard.css';
import '../../styles/hire-help-theme.css';

export default function RedesignPreview() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [labRecords, setLabRecords] = useState([]);
  const [savedMealPlan, setSavedMealPlan] = useState(null);
  const [savedDietPlan, setSavedDietPlan] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const activePatientIdRef = useRef(null);

  // Modals
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [editingLabRecord, setEditingLabRecord] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load live patients from backend
  const loadPatients = async (search = '') => {
    try {
      setLoadingPatients(true);
      const res = await api.getPatients(search);
      const list = res.data?.patients || [];
      setPatients(list);

      if (activePatient) {
        const refreshed = list.find((p) => p.id === activePatient.id);
        if (refreshed) setActivePatient(refreshed);
      } else if (list.length > 0 && !search) {
        handleSelectPatient(list[0]);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      showToast('Could not load patient list from backend.', 'error');
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    loadPatients(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Select patient & load assessment details
  const handleSelectPatient = async (patient) => {
    activePatientIdRef.current = patient.id;
    setActivePatient(patient);
    setActiveAssessment(null);
    setLabRecords([]);
    setSavedMealPlan(null);
    setSavedDietPlan(null);

    try {
      setLoadingAssessment(true);
      const [assessmentResult, mealResult, dietResult] = await Promise.allSettled([
        api.getPatientAssessments(patient.id),
        api.getPatientMealPlans(patient.id),
        api.getPatientDietPlans(patient.id),
      ]);

      if (activePatientIdRef.current !== patient.id) return;

      if (assessmentResult.status === 'fulfilled') {
        const assessments = assessmentResult.value?.data?.assessments || [];
        if (assessments.length > 0) {
          const latest = assessments[0];
          setActiveAssessment(latest);

          try {
            const labRes = await api.getLabData(latest.id);
            if (activePatientIdRef.current === patient.id) {
              setLabRecords(labRes.data?.labData || []);
            }
          } catch (labErr) {
            console.error('Error loading lab data:', labErr);
          }
        }
      }

      if (mealResult.status === 'fulfilled') {
        const mealPlans = mealResult.value?.data || [];
        if (Array.isArray(mealPlans) && mealPlans.length > 0) {
          setSavedMealPlan(mealPlans[0]);
        }
      }

      if (dietResult.status === 'fulfilled') {
        const dietPlans = dietResult.value?.data || [];
        if (Array.isArray(dietPlans) && dietPlans.length > 0) {
          setSavedDietPlan(dietPlans[0]);
        }
      }
    } catch (err) {
      console.error('Error loading patient details:', err);
    } finally {
      if (activePatientIdRef.current === patient.id) {
        setLoadingAssessment(false);
      }
    }
  };

  const handlePatientCreated = async (payload) => {
    const res = await api.createPatient(payload);
    const newPat = res.data?.patient;
    showToast(`Patient ${newPat?.name} registered (${newPat?.patient_code}).`, 'success');
    await loadPatients();
    if (newPat) handleSelectPatient(newPat);
  };

  const handleSaveAssessment = async (payload) => {
    if (!activePatient) return;
    if (activeAssessment && activeAssessment.id) {
      const res = await api.updateAssessment(activeAssessment.id, payload);
      setActiveAssessment(res.data?.assessment);
      showToast('Patient assessment successfully updated.', 'success');
      await loadPatients(searchQuery);
    } else {
      const res = await api.createAssessment(activePatient.id, payload);
      setActiveAssessment(res.data?.assessment);
      showToast('New patient assessment saved.', 'success');
      await loadPatients(searchQuery);
    }
  };

  const handleSaveLabRecord = async (labData) => {
    if (!activeAssessment || !activeAssessment.id) {
      showToast('Please save patient assessment first.', 'error');
      return;
    }
    try {
      if (editingLabRecord) {
        await api.updateLabData(editingLabRecord.id, labData);
        showToast('Clinical lab test updated.', 'success');
      } else {
        await api.addLabData(activeAssessment.id, labData);
        showToast('Clinical lab test added.', 'success');
      }
      const labRes = await api.getLabData(activeAssessment.id);
      setLabRecords(labRes.data?.labData || []);
      setEditingLabRecord(null);
    } catch (err) {
      showToast(err.message || 'Failed to save lab data', 'error');
    }
  };

  const handleDeleteLabRecord = async (labId) => {
    if (!window.confirm('Delete this lab test record?')) return;
    try {
      await api.deleteLabData(labId);
      showToast('Clinical record deleted.', 'success');
      setLabRecords((prev) => prev.filter((item) => item.id !== labId));
    } catch (err) {
      showToast(err.message || 'Failed to delete lab record', 'error');
    }
  };

  // Route Titles
  const routeMeta = {
    dashboard: { title: 'Clinical Dashboard' },
    patients: { title: 'Patient Directory' },
    clinical: { title: 'Clinical Assessment' },
    knowledge: { title: 'Classical Ayurvedic Knowledge Base' },
    reports: { title: 'Diet Reports & Prescriptions' },
    login: { title: 'Dietitian Login' },
  };

  // If user navigated to login view, render clean login
  if (currentRoute === 'login') {
    return <LoginView onLoginSuccess={() => setCurrentRoute('dashboard')} />;
  }

  return (
    <AppLayout
      currentRoute={currentRoute}
      onRouteChange={setCurrentRoute}
      title={routeMeta[currentRoute]?.title || 'AyurDiet'}
      subtitle={routeMeta[currentRoute]?.subtitle}
      activePatient={activePatient}
      onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
      patientCount={patients.length}
    >
      {/* Toast Banner */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: toast.type === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
            color: '#FFFFFF',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontWeight: 700 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* View Switcher Content */}
      {currentRoute === 'dashboard' && (
        <DashboardView
          patients={patients}
          activePatient={activePatient}
          onSelectPatient={handleSelectPatient}
          onNavigate={setCurrentRoute}
          onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
        />
      )}

      {currentRoute === 'patients' && (
        <PatientDirectoryView
          patients={patients}
          activePatient={activePatient}
          onSelectPatient={handleSelectPatient}
          onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
          onNavigate={setCurrentRoute}
        />
      )}

      {currentRoute === 'clinical' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', minHeight: 'calc(100vh - 160px)' }}>
          {/* Embedded Patient Selection Sidebar */}
          <div style={{ background: 'var(--color-pure-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <PatientSidebar
              patients={patients}
              activePatient={activePatient}
              onSelectPatient={handleSelectPatient}
              onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
              onOpenKnowledgeBase={() => setCurrentRoute('knowledge')}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={loadingPatients}
            />
          </div>

          {/* Assessment Form Main Workspace */}
          <div style={{ background: 'var(--color-pure-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '1.5rem', overflowY: 'auto' }}>
            {activePatient ? (
              loadingAssessment ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-slate-muted)' }}>
                  Loading patient assessment...
                </div>
              ) : (
                <AssessmentForm
                  patient={activePatient}
                  existingAssessment={activeAssessment}
                  onSaveAssessment={handleSaveAssessment}
                  onOpenLabModal={() => {
                    setEditingLabRecord(null);
                    setIsLabModalOpen(true);
                  }}
                  onEditLabRecord={(item) => {
                    setEditingLabRecord(item);
                    setIsLabModalOpen(true);
                  }}
                  onDeleteLabRecord={handleDeleteLabRecord}
                  labRecords={labRecords}
                  savedMealPlan={savedMealPlan}
                  savedDietPlan={savedDietPlan}
                  onMealPlanSaved={setSavedMealPlan}
                  onDietPlanSaved={setSavedDietPlan}
                />
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-slate-muted)' }}>
                Please select a patient from the left column to view or conduct their assessment.
              </div>
            )}
          </div>
        </div>
      )}

      {currentRoute === 'knowledge' && (
        <div style={{ background: 'var(--color-pure-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '1.5rem' }}>
          <RAGKnowledgeViewer />
        </div>
      )}

      {currentRoute === 'reports' && (
        <DietPlanPrintView activePatient={activePatient} />
      )}

      {/* Modals */}
      <NewPatientModal
        isOpen={isNewPatientOpen}
        onClose={() => setIsNewPatientOpen(false)}
        onPatientCreated={handlePatientCreated}
      />

      <ClinicalLabModal
        isOpen={isLabModalOpen}
        onClose={() => {
          setIsLabModalOpen(false);
          setEditingLabRecord(null);
        }}
        onSave={handleSaveLabRecord}
        initialData={editingLabRecord}
      />
    </AppLayout>
  );
}
