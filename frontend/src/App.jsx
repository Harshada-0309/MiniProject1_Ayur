import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from './components/layout/AppLayout';
import DashboardView from './components/dashboard/DashboardView';
import PatientDirectoryView from './components/patients/PatientDirectoryView';
import MealPlannerPage from './components/meals/MealPlannerPage';
import DietPlanPrintView from './components/reports/DietPlanPrintView';
import LandingPage from './components/landing/LandingPage';
import LoginView from './components/auth/LoginView';

// Existing clinical components
import PatientSidebar from './components/PatientSidebar';
import AssessmentForm from './components/AssessmentForm';
import NewPatientModal from './components/NewPatientModal';
import ClinicalLabModal from './components/ClinicalLabModal';
import RAGKnowledgeViewer from './components/RAGKnowledgeViewer';
import DietitianProfileModal from './components/profile/DietitianProfileModal';
import PatientProfileModal from './components/patients/PatientProfileModal';
import DeletePatientModal from './components/patients/DeletePatientModal';
import DashboardIcon from './components/ui/DashboardIcons';

import { api, tokenStorage } from './services/api';
import './styles/teal-tokens.css';
import './styles/premium-dashboard.css';
import './styles/hire-help-theme.css';

// Route path to internal route ID mapper
function parsePathToRoute(pathname) {
  const clean = pathname.replace(/\/$/, '') || '/';
  if (clean === '/') return 'landing';
  if (clean === '/login') return 'login';
  if (clean === '/ai-assistant') return 'dashboard';
  const sub = clean.replace(/^\//, '');
  const privateRoutes = ['dashboard', 'patients', 'clinical', 'meal-planner', 'knowledge', 'reports', 'profile'];
  return privateRoutes.includes(sub) ? sub : 'landing';
}

function routeToPath(route) {
  if (route === 'landing') return '/';
  if (route === 'login') return '/login';
  if (route === 'ai-assistant') return '/dashboard';
  return `/${route}`;
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState(() => parsePathToRoute(window.location.pathname));
  const [isAuthenticated, setIsAuthenticated] = useState(() => api.isAuthenticated());
  const [dietitian, setDietitian] = useState(() => api.getStoredDietitian());
  const [authChecking, setAuthChecking] = useState(true);

  // Clinical data state
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

  // Modals state
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [patientForProfileModal, setPatientForProfileModal] = useState(null);
  const [isPatientProfileOpen, setIsPatientProfileOpen] = useState(false);
  const [editingLabRecord, setEditingLabRecord] = useState(null);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);
  const [showPatientSidebar, setShowPatientSidebar] = useState(false);
  const [toast, setToast] = useState(null);

  const handleUpdatePatientPhoto = (patientId, photoUrl) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, photo_url: photoUrl } : p))
    );
    if (activePatient && activePatient.id === patientId) {
      setActivePatient((prev) => ({ ...prev, photo_url: photoUrl }));
    }
    if (patientForProfileModal && patientForProfileModal.id === patientId) {
      setPatientForProfileModal((prev) => ({ ...prev, photo_url: photoUrl }));
    }
    showToast('Patient clinical photo updated successfully.', 'success');
  };

  const handlePatientProfileUpdated = (updatedPatient) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === updatedPatient.id ? { ...p, ...updatedPatient } : p))
    );
    if (activePatient && activePatient.id === updatedPatient.id) {
      setActivePatient((prev) => ({ ...prev, ...updatedPatient }));
    }
    setPatientForProfileModal((prev) => ({ ...prev, ...updatedPatient }));
    showToast(`Patient profile for ${updatedPatient.name} updated successfully.`, 'success');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleDietitianProfileUpdated = useCallback((updatedDietitian) => {
    setDietitian(updatedDietitian);
    showToast('Dietitian clinical profile updated successfully.', 'success');
  }, []);

  // Safe navigation helper that updates browser URL and state
  const navigateTo = useCallback((targetRoute) => {
    const route = targetRoute === 'ai-assistant' ? 'dashboard' : targetRoute;
    const targetPath = routeToPath(route);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setCurrentRoute(route);
  }, []);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = parsePathToRoute(window.location.pathname);
      setCurrentRoute(route);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-open dietitian profile modal when on profile route
  useEffect(() => {
    if (currentRoute === 'profile') {
      setIsProfileModalOpen(true);
    }
  }, [currentRoute]);

  // Validate authentication state on application boot
  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      if (api.isAuthenticated()) {
        try {
          const res = await api.getCurrentUser();
          if (isMounted && res?.data?.dietitian) {
            setDietitian(res.data.dietitian);
            setIsAuthenticated(true);
          }
        } catch (err) {
          console.warn('Session verification failed, logging out:', err.message);
          tokenStorage.remove();
          if (isMounted) {
            setIsAuthenticated(false);
            setDietitian(null);
          }
        }
      } else {
        if (isMounted) {
          setIsAuthenticated(false);
          setDietitian(null);
        }
      }
      if (isMounted) setAuthChecking(false);
    };

    validateSession();

    // Listen for 401 unauthorized events from api.js
    const handleAuthExpired = () => {
      try {
        localStorage.removeItem('ayurdiet_active_patient_id');
      } catch {
        // ignore
      }
      setPatients([]);
      setActivePatient(null);
      setActiveAssessment(null);
      setLabRecords([]);
      setSavedMealPlan(null);
      setSavedDietPlan(null);
      setIsAuthenticated(false);
      setDietitian(null);
      showToast('Your clinical session has expired. Please log in again.', 'error');
      navigateTo('login');
    };

    window.addEventListener('ayurdiet:auth-expired', handleAuthExpired);

    return () => {
      isMounted = false;
      window.removeEventListener('ayurdiet:auth-expired', handleAuthExpired);
    };
  }, [navigateTo]);

  // Route protection guard
  useEffect(() => {
    if (authChecking) return;

    const isPublicRoute = currentRoute === 'landing' || currentRoute === 'login';

    if (!isAuthenticated && !isPublicRoute) {
      // Unauthenticated visitor trying to access private route
      showToast('Authentication required. Please sign in to access clinical records.', 'error');
      navigateTo('login');
    } else if (isAuthenticated && currentRoute === 'login') {
      // Authenticated user already logged in trying to access login page
      navigateTo('dashboard');
    }
  }, [currentRoute, isAuthenticated, authChecking, navigateTo]);

  // Load patients from backend when authenticated
  const loadPatients = useCallback(async (search = '') => {
    if (!api.isAuthenticated()) return;

    try {
      setLoadingPatients(true);
      const res = await api.getPatients(search);
      const list = res.data?.patients || [];
      setPatients(list);

      // If active patient is still in list, refresh it
      if (activePatient) {
        const refreshed = list.find((p) => p.id === activePatient.id);
        if (refreshed) {
          setActivePatient(refreshed);
        } else {
          // Previously selected patient does NOT belong to this doctor account
          if (list.length > 0) {
            handleSelectPatient(list[0]);
          } else {
            setActivePatient(null);
            setActiveAssessment(null);
            setLabRecords([]);
            setSavedMealPlan(null);
            setSavedDietPlan(null);
            try {
              localStorage.removeItem('ayurdiet_active_patient_id');
            } catch {
              // ignore
            }
          }
        }
      } else if (list.length > 0 && !search) {
        let savedId = null;
        try {
          savedId = localStorage.getItem('ayurdiet_active_patient_id');
        } catch {
          // ignore
        }
        const matched = savedId ? list.find((p) => String(p.id) === String(savedId)) : null;
        handleSelectPatient(matched || list[0]);
      } else if (list.length === 0) {
        setActivePatient(null);
        setActiveAssessment(null);
        setLabRecords([]);
        setSavedMealPlan(null);
        setSavedDietPlan(null);
        try {
          localStorage.removeItem('ayurdiet_active_patient_id');
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      // Suppress toast if unauthenticated redirect is already handling it
      if (err.status !== 401) {
        showToast('Could not load patient list from backend.', 'error');
      }
    } finally {
      setLoadingPatients(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatient]);

  useEffect(() => {
    if (isAuthenticated) {
      loadPatients(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, searchQuery]);

  // Select patient and load latest assessment, lab records, and saved plans independently
  const handleSelectPatient = async (patient) => {
    activePatientIdRef.current = patient.id;
    try {
      localStorage.setItem('ayurdiet_active_patient_id', String(patient.id));
    } catch {
      // ignore
    }
    setActivePatient(patient);
    setActiveAssessment(null);
    setLabRecords([]);
    setSavedMealPlan(null);
    setSavedDietPlan(null);
    setShowPatientSidebar(false);

    try {
      setLoadingAssessment(true);

      const [assessmentResult, mealResult, dietResult] = await Promise.allSettled([
        api.getPatientAssessments(patient.id),
        api.getPatientMealPlans(patient.id),
        api.getPatientDietPlans(patient.id),
      ]);

      if (activePatientIdRef.current !== patient.id) {
        return;
      }

      // 1. Process Assessment & Lab data
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
            console.error('Error loading lab data for assessment:', labErr);
          }
        }
      } else {
        console.error('Error loading patient assessment:', assessmentResult.reason);
      }

      // 2. Process Saved Meal Plans
      if (mealResult.status === 'fulfilled') {
        const mealPlans = mealResult.value?.data || [];
        if (Array.isArray(mealPlans) && mealPlans.length > 0) {
          setSavedMealPlan(mealPlans[0]);
        } else {
          setSavedMealPlan(null);
        }
      }

      // 3. Process Saved 7-Day Diet Plans
      if (dietResult.status === 'fulfilled') {
        const dietPlans = dietResult.value?.data || [];
        if (Array.isArray(dietPlans) && dietPlans.length > 0) {
          setSavedDietPlan(dietPlans[0]);
        } else {
          setSavedDietPlan(null);
        }
      }
    } catch (err) {
      console.error('Unexpected error loading patient details:', err);
      showToast('Error loading patient details.', 'error');
    } finally {
      if (activePatientIdRef.current === patient.id) {
        setLoadingAssessment(false);
      }
    }
  };

  // Register new patient
  const handlePatientCreated = async (payload) => {
    try {
      const res = await api.createPatient(payload);
      const newPat = res.data?.patient;
      showToast(`Patient ${newPat?.name} registered (${newPat?.patient_code}).`, 'success');
      await loadPatients();
      if (newPat) {
        handleSelectPatient(newPat);
      }
    } catch (err) {
      console.error('Error creating patient:', err);
      showToast(err.message || 'Failed to register patient', 'error');
    }
  };

  // Delete patient record safely with transactional cleanup and immediate UI synchronization
  const handleConfirmDeletePatient = async (patientId) => {
    try {
      setIsDeletingPatient(true);
      await api.deletePatient(patientId);
      const patientName = patientToDelete?.name || 'Patient';
      const patientCode = patientToDelete?.patient_code || '';

      // Immediately synchronize local patients list
      setPatients((prev) => prev.filter((p) => p.id !== patientId));

      // If active patient was deleted, reset active state & navigate cleanly
      if (activePatient && activePatient.id === patientId) {
        setActivePatient(null);
        setActiveAssessment(null);
        setLabRecords([]);
        setSavedMealPlan(null);
        setSavedDietPlan(null);
        try {
          localStorage.removeItem('ayurdiet_active_patient_id');
        } catch {
          // ignore
        }
        if (currentRoute === 'clinical') {
          navigateTo('patients');
        }
      }

      showToast(`Patient ${patientName} (${patientCode}) was deleted successfully.`, 'success');
      setPatientToDelete(null);
    } catch (err) {
      console.error('Failed to delete patient:', err);
      showToast(err.message || 'Failed to delete patient record.', 'error');
      throw err;
    } finally {
      setIsDeletingPatient(false);
    }
  };

  // Save or Update Assessment
  const handleSaveAssessment = async (payload) => {
    if (!activePatient) return;

    try {
      // 1. Update patient record if patient details are provided in payload
      const patientUpdates = {};
      if (payload.name !== undefined) patientUpdates.name = payload.name.trim();
      if (payload.age !== undefined && payload.age !== '') patientUpdates.age = parseInt(payload.age, 10);
      if (payload.sex !== undefined) patientUpdates.sex = payload.sex;
      if (payload.occupation !== undefined) patientUpdates.occupation = payload.occupation.trim();

      let currentPatient = activePatient;
      if (Object.keys(patientUpdates).length > 0) {
        const patientRes = await api.updatePatient(activePatient.id, patientUpdates);
        if (patientRes.data?.patient) {
          currentPatient = patientRes.data.patient;
          setActivePatient(currentPatient);
        }
      }

      // 2. Save or update assessment
      if (activeAssessment && activeAssessment.id) {
        const res = await api.updateAssessment(activeAssessment.id, payload);
        const updated = res.data?.assessment;
        if (updated) {
          setActiveAssessment(updated);
          if (updated.patient) {
            currentPatient = updated.patient;
            setActivePatient(currentPatient);
          }
        }
        showToast('Patient assessment successfully updated.', 'success');
        await loadPatients(searchQuery);
      } else {
        const res = await api.createAssessment(activePatient.id, payload);
        const created = res.data?.assessment;
        if (created) {
          setActiveAssessment(created);
        }
        showToast('New patient assessment successfully created and saved.', 'success');
        await loadPatients(searchQuery);
      }
    } catch (err) {
      console.error('Error saving assessment:', err);
      showToast(err.message || 'Failed to save assessment', 'error');
      throw err;
    }
  };

  // Save Lab Record
  const handleSaveLabRecord = async (labData) => {
    if (!activeAssessment || !activeAssessment.id) {
      showToast('Please save the patient assessment first.', 'error');
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
      console.error('Error saving lab record:', err);
      showToast(err.message || 'Failed to save lab data record', 'error');
    }
  };

  // Delete Lab Record
  const handleDeleteLabRecord = async (labId) => {
    if (!window.confirm('Are you sure you want to remove this lab test record?')) return;

    try {
      await api.deleteLabData(labId);
      showToast('Clinical record deleted.', 'success');
      setLabRecords((prev) => prev.filter((item) => item.id !== labId));
    } catch (err) {
      console.error('Error deleting lab record:', err);
      showToast(err.message || 'Failed to delete lab record', 'error');
    }
  };

  // Delete Lab Attachment Metadata
  const handleDeleteLabAttachment = async (labRecord) => {
    if (!window.confirm(`Are you sure you want to remove the attached report file for "${labRecord.test_name}"? The test record will remain intact.`)) {
      return;
    }

    try {
      await api.deleteLabAttachment(labRecord.id);
      showToast('Report attachment removed.', 'success');
      setLabRecords((prev) =>
        prev.map((item) =>
          item.id === labRecord.id ? { ...item, report_file_metadata: null } : item
        )
      );
    } catch (err) {
      console.error('Error deleting lab attachment:', err);
      showToast(err.message || 'Failed to delete attachment', 'error');
    }
  };

  // Authentication callbacks
  const handleLoginSuccess = (dietitianData) => {
    // Clear previous doctor patient state immediately
    setPatients([]);
    setActivePatient(null);
    setActiveAssessment(null);
    setLabRecords([]);
    setSavedMealPlan(null);
    setSavedDietPlan(null);
    setSearchQuery('');

    setIsAuthenticated(true);
    setDietitian(dietitianData);
    showToast(`Welcome back, ${dietitianData.name || 'Practitioner'}.`, 'success');
    navigateTo('dashboard');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout warning:', err);
    } finally {
      try {
        localStorage.removeItem('ayurdiet_active_patient_id');
      } catch {
        // ignore
      }
      setPatients([]);
      setActivePatient(null);
      setActiveAssessment(null);
      setLabRecords([]);
      setSavedMealPlan(null);
      setSavedDietPlan(null);
      setSearchQuery('');
      setIsAuthenticated(false);
      setDietitian(null);
      showToast('Signed out of clinical portal successfully.', 'success');
      navigateTo('landing');
    }
  };

  // Route metadata
  const routeMeta = {
    dashboard: {
      title: 'Clinical Dashboard',
    },
    profile: {
      title: 'Dietitian Clinical Profile',
    },
    patients: {
      title: 'Patient Directory',
    },
    clinical: {
      title: 'Clinical Assessment',
    },
    'meal-planner': {
      title: 'Ayurvedic Meal Planner',
    },
    knowledge: {
      title: 'Classical Ayurvedic Knowledge Base',
    },
    reports: {
      title: 'Diet Reports & Prescriptions',
    },
  };

  // 1. Public Landing Page Route (/)
  if (currentRoute === 'landing') {
    return (
      <>
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
        <LandingPage onNavigateToLogin={() => navigateTo('login')} />
      </>
    );
  }

  // 2. Public Login Page Route (/login)
  if (currentRoute === 'login') {
    return (
      <>
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
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onNavigateToLanding={() => navigateTo('landing')}
        />
      </>
    );
  }

  // 3. Protected Clinical Application Shell (/dashboard, /patients, /clinical, etc.)
  return (
    <AppLayout
      currentRoute={currentRoute}
      onRouteChange={navigateTo}
      title={routeMeta[currentRoute]?.title || 'AyurDiet'}
      subtitle={routeMeta[currentRoute]?.subtitle}
      activePatient={activePatient}
      onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
      patientCount={patients.length}
      dietitian={dietitian}
      onOpenProfileModal={() => setIsProfileModalOpen(true)}
      onLogout={handleLogout}
    >
      {/* Toast Notification Banner */}
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
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1.1rem',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* View Switching */}
      {(currentRoute === 'dashboard' || currentRoute === 'profile') && (
        <DashboardView
          patients={patients}
          activePatient={activePatient}
          onSelectPatient={handleSelectPatient}
          onNavigate={navigateTo}
          onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
          dietitian={dietitian}
        />
      )}

      {currentRoute === 'patients' && (
        <PatientDirectoryView
          patients={patients}
          activePatient={activePatient}
          onSelectPatient={handleSelectPatient}
          onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
          onNavigate={navigateTo}
          onUpdatePatientPhoto={handleUpdatePatientPhoto}
          onRequestDeletePatient={(p) => setPatientToDelete(p)}
          onOpenPatientProfile={(p) => {
            setPatientForProfileModal(p);
            setIsPatientProfileOpen(true);
          }}
        />
      )}

      {currentRoute === 'clinical' && (
        <div className="clinical-workspace-container">
          <div
            className="clinical-workspace-split"
            style={{
              display: 'grid',
              gridTemplateColumns: (!showPatientSidebar && activePatient) ? '1fr' : 'minmax(280px, 320px) 1fr',
              gap: '1.5rem',
              minHeight: 'calc(100vh - 160px)',
              alignItems: 'start',
            }}
          >
            {/* Patient Selection Sidebar */}
            {(showPatientSidebar || !activePatient) && (
              <div
                style={{
                  background: 'var(--color-pure-white)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'sticky',
                  top: '85px',
                }}
              >
                <PatientSidebar
                  patients={patients}
                  activePatient={activePatient}
                  onSelectPatient={(p) => {
                    handleSelectPatient(p);
                    setShowPatientSidebar(false);
                  }}
                  onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
                  onOpenKnowledgeBase={() => navigateTo('knowledge')}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  loading={loadingPatients}
                  onRequestDeletePatient={(p) => setPatientToDelete(p)}
                />
              </div>
            )}

            {/* Assessment Form Main Workspace */}
            <div
              style={{
                background: 'var(--color-pure-white)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                padding: '1.75rem',
                boxShadow: 'var(--shadow-sm)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {activePatient ? (
                loadingAssessment ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-slate-muted)' }}>
                    Loading patient clinical assessment...
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
                    onDeleteLabAttachment={handleDeleteLabAttachment}
                    labRecords={labRecords}
                    savedMealPlan={savedMealPlan}
                    savedDietPlan={savedDietPlan}
                    onMealPlanSaved={setSavedMealPlan}
                    onDietPlanSaved={setSavedDietPlan}
                    onSwitchPatient={() => setShowPatientSidebar((prev) => !prev)}
                    showPatientSidebar={showPatientSidebar}
                    onOpenNewPatientModal={() => setIsNewPatientOpen(true)}
                    onUpdatePatientPhoto={handleUpdatePatientPhoto}
                    onRequestDeletePatient={(p) => setPatientToDelete(p)}
                  />
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-slate-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--color-primary)' }}>
                    <DashboardIcon name="clipboard-check" size={44} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--color-deep-slate)', marginBottom: '0.4rem' }}>
                    No Patient Selected
                  </h3>
                  <p style={{ maxWidth: '420px', margin: '0 auto 1.25rem', fontSize: '0.9rem' }}>
                    Select an existing patient from the directory to conduct or review their clinical & Ayurvedic assessment, or register a new patient.
                  </p>
                  <button
                    type="button"
                    className="btn-ayur-primary"
                    onClick={() => setIsNewPatientOpen(true)}
                  >
                    + Register New Patient
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentRoute === 'meal-planner' && (
        <MealPlannerPage
          activePatient={activePatient}
          activeAssessment={activeAssessment}
          savedMealPlan={savedMealPlan}
          savedDietPlan={savedDietPlan}
          onMealPlanSaved={setSavedMealPlan}
          onDietPlanSaved={setSavedDietPlan}
          onNavigate={navigateTo}
        />
      )}

      {currentRoute === 'knowledge' && (
        <div
          style={{
            background: 'var(--color-pure-white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <RAGKnowledgeViewer />
        </div>
      )}

      {currentRoute === 'reports' && (
        <DietPlanPrintView
          activePatient={activePatient}
          activeAssessment={activeAssessment}
          dietPlan={savedDietPlan}
          onBack={() => setCurrentRoute('clinical')}
        />
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

      <DietitianProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          if (currentRoute === 'profile') {
            navigateTo('dashboard');
          }
        }}
        dietitian={dietitian}
        onProfileUpdated={handleDietitianProfileUpdated}
      />

      <PatientProfileModal
        isOpen={isPatientProfileOpen}
        patient={patientForProfileModal}
        onClose={() => {
          setIsPatientProfileOpen(false);
          setPatientForProfileModal(null);
        }}
        onPatientUpdated={handlePatientProfileUpdated}
        onStartAssessment={(p) => {
          setIsPatientProfileOpen(false);
          handleSelectPatient(p);
          navigateTo('clinical');
        }}
        onRequestDelete={(p) => {
          setIsPatientProfileOpen(false);
          setPatientToDelete(p);
        }}
      />

      <DeletePatientModal
        isOpen={Boolean(patientToDelete)}
        patient={patientToDelete}
        onClose={() => {
          if (!isDeletingPatient) setPatientToDelete(null);
        }}
        onConfirmDelete={handleConfirmDeletePatient}
        isDeleting={isDeletingPatient}
      />
    </AppLayout>
  );
}
