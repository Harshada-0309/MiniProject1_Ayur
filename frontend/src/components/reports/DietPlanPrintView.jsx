import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DashboardIcon from '../ui/DashboardIcons';

export default function DietPlanPrintView({
  activePatient,
  activeAssessment,
  dietPlan: initialDietPlan,
  onBack,
  onApprove,
}) {
  const [dietPlan, setDietPlan] = useState(initialDietPlan || null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // WhatsApp Dispatch Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState(activePatient?.phone || '');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppResult, setWhatsAppResult] = useState(null);
  const [whatsAppError, setWhatsAppError] = useState(null);
  const [whatsAppHistory, setWhatsAppHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (initialDietPlan) {
      setDietPlan(initialDietPlan);
    } else if (activePatient?.id) {
      const fetchPlan = async () => {
        try {
          setLoading(true);
          const res = await api.getPatientDietPlans(activePatient.id);
          const plans = res.data || [];
          if (plans.length > 0) {
            setDietPlan(plans[0]);
          }
        } catch (err) {
          console.error('Error loading diet plan for report:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchPlan();
    }
  }, [initialDietPlan, activePatient]);

  // Keep phone in sync when activePatient changes
  useEffect(() => {
    if (activePatient?.phone) {
      setWhatsAppPhone(activePatient.phone);
    }
  }, [activePatient]);

  const isApproved = Boolean(dietPlan?.is_approved);
  const planValidation = dietPlan?.validation_results || {};

  // Fetch WhatsApp dispatch history
  const loadWhatsAppHistory = async () => {
    if (!dietPlan?.id) return;
    try {
      setLoadingHistory(true);
      const res = await api.getWhatsAppHistory(dietPlan.id);
      setWhatsAppHistory(res.data?.history || []);
    } catch (err) {
      console.warn('Failed to load WhatsApp dispatch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenWhatsAppModal = () => {
    setWhatsAppResult(null);
    setWhatsAppError(null);
    setConsentConfirmed(false);
    setShowWhatsAppModal(true);
    loadWhatsAppHistory();
  };

  // Dispatch WhatsApp prescription
  const handleSendWhatsApp = async () => {
    if (!dietPlan?.id) return;
    if (!consentConfirmed) {
      setWhatsAppError('Patient consent confirmation is required before dispatching.');
      return;
    }

    setSendingWhatsApp(true);
    setWhatsAppError(null);
    setWhatsAppResult(null);

    try {
      const res = await api.sendPrescriptionWhatsApp(dietPlan.id, {
        phone: whatsAppPhone.trim(),
        consent_confirmed: true,
      });

      setWhatsAppResult(res.data);
      // Reload history to show updated audit log
      loadWhatsAppHistory();
    } catch (err) {
      console.error('WhatsApp send error:', err);
      setWhatsAppError(err.message || 'Failed to dispatch WhatsApp prescription.');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Handle Download PDF binary
  const handleDownloadPdf = async () => {
    if (!dietPlan?.id) {
      alert('No saved diet plan available to download.');
      return;
    }
    if (!isApproved) {
      alert('Formal dietitian approval is required before downloading the official prescription PDF.');
      return;
    }

    setDownloadingPdf(true);
    setDownloadError(null);

    try {
      const blob = await api.downloadDietPlanPdf(dietPlan.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const patientCode = activePatient?.patient_code || `PAT-${activePatient?.id || '001'}`;
      const todayStr = new Date().toISOString().split('T')[0];
      a.download = `AyurDiet_Prescription_${patientCode}_${todayStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download PDF error:', err);
      setDownloadError(err.message || 'Failed to download PDF. Please try browser print instead.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle Print Action
  const handlePrint = () => {
    if (!isApproved) {
      const proceed = window.confirm(
        'Warning: This plan has not been formally approved by a registered dietitian yet. Do you want to print an unapproved clinical draft?'
      );
      if (!proceed) return;
    }
    window.print();
  };

  // Helper macro calculations across 7 days
  const days = dietPlan?.days || [];
  const dayCount = Math.max(days.length, 1);
  const totalCals = days.reduce((sum, d) => sum + (Number(d.daily_totals?.calories) || 0), 0);
  const totalProt = days.reduce((sum, d) => sum + (Number(d.daily_totals?.protein_g) || 0), 0);
  const totalCarb = days.reduce((sum, d) => sum + (Number(d.daily_totals?.carbohydrate_g) || 0), 0);
  const totalFat = days.reduce((sum, d) => sum + (Number(d.daily_totals?.fat_g) || 0), 0);
  const totalFiber = days.reduce((sum, d) => sum + (Number(d.daily_totals?.fiber_g) || 0), 0);

  const avgCals = Math.round((totalCals / dayCount) * 10) / 10;
  const avgProt = Math.round((totalProt / dayCount) * 10) / 10;
  const avgCarb = Math.round((totalCarb / dayCount) * 10) / 10;
  const avgFat = Math.round((totalFat / dayCount) * 10) / 10;
  const avgFiber = Math.round((totalFiber / dayCount) * 10) / 10;

  const targets = dietPlan?.nutrition_targets || planValidation?.nutrition_targets || {};
  const targetCals = targets?.energy?.target_energy_kcal_day || targets?.target_energy_kcal_day || '—';
  const targetProt = targets?.macronutrients?.protein?.target_g || targets?.protein_g || '—';
  const targetCarb = targets?.macronutrients?.carbohydrate?.target_g || targets?.carbohydrate_g || '—';
  const targetFat = targets?.macronutrients?.fat?.target_g || targets?.fat_g || '—';

  const labSummary = dietPlan?.clinical_lab_summary || planValidation?.clinical_lab_summary;

  // Extract patient metrics safely
  const pName = activePatient?.name || 'Patient';
  const pCode = activePatient?.patient_code || `PAT-${activePatient?.id || '001'}`;
  const pAge = activePatient?.age || activeAssessment?.age || '—';
  const pSex = (activePatient?.sex || activeAssessment?.sex || '—').toUpperCase();
  const pHeight = activeAssessment?.height || activePatient?.height || '—';
  const pWeight = activeAssessment?.weight || activePatient?.weight || '—';
  const pBmi = activeAssessment?.bmi || activePatient?.bmi || '—';
  const pPrakriti = activeAssessment?.prakriti || activePatient?.prakriti || 'Vata-Pitta';
  const pVikriti = activeAssessment?.vikriti || 'Pitta Aggravation';
  const pAgni = activeAssessment?.appetite || activeAssessment?.digestive_fire || 'Samagni (Balanced)';
  const pGoal = (activeAssessment?.diet_goal || activePatient?.diet_goal || 'General Health').replace(/_/g, ' ');
  const pAllergies = activeAssessment?.food_allergies || activePatient?.allergies || [];
  const pConditions = activeAssessment?.existing_conditions || activePatient?.existing_conditions || [];

  return (
    <div className="prescription-wrapper" style={{ padding: '1.25rem', minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
      {/* Strict Print-Specific Style Rules */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 10pt !important;
          }
          .no-print,
          .ayur-sidebar,
          .ayur-header,
          .ayur-sidebar-backdrop,
          .action-footer,
          .modal-overlay,
          button {
            display: none !important;
          }
          .prescription-wrapper {
            padding: 0 !important;
            background-color: #ffffff !important;
          }
          .prescription-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top Action Toolbar (Hidden during Print) */}
      <div
        className="no-print"
        style={{
          maxWidth: '1020px',
          margin: '0 auto 1.25rem',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '0.85rem 1.25rem',
          border: '1px solid #cbd5e1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBack && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.82rem',
                padding: '0.45rem 0.85rem',
                cursor: 'pointer',
              }}
            >
              <span>← Back to Assessment</span>
            </button>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#1b4332' }}>
              Final Diet Prescription &amp; Clinical Dispatch
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
              {isApproved
                ? `✓ Approved & Signed off by ${dietPlan?.approved_by || 'Dietitian'}`
                : '⚠ Unapproved Draft — Dietitian sign-off required before clinical dispatch'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {downloadError && (
            <span style={{ fontSize: '0.75rem', color: '#dc2626', marginRight: '0.5rem' }}>
              {downloadError}
            </span>
          )}

          {/* WhatsApp Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenWhatsAppModal}
            disabled={!isApproved}
            title={!isApproved ? 'Dietitian approval required before WhatsApp delivery' : 'Send prescription to patient via WhatsApp'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.45rem 0.95rem',
              backgroundColor: isApproved ? '#25D366' : '#e2e8f0',
              borderColor: isApproved ? '#128C7E' : '#cbd5e1',
              color: isApproved ? '#ffffff' : '#64748b',
              fontWeight: 600,
              cursor: !isApproved ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
            }}
          >
            <DashboardIcon name="whatsapp" size={15} />
            <span>Send via WhatsApp</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || !isApproved}
            title={!isApproved ? 'Please approve plan first' : 'Download official PDF document'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.45rem 0.95rem',
              borderColor: '#0284c7',
              color: '#0284c7',
              opacity: !isApproved ? 0.6 : 1,
              cursor: !isApproved ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
            }}
          >
            <DashboardIcon name="download" size={14} />
            <span>{downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
          </button>

          {/* Print Prescription Button */}
          <button
            type="button"
            className="btn-primary"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.45rem 1.1rem',
              backgroundColor: isApproved ? '#1b4332' : '#64748b',
              cursor: 'pointer',
              borderRadius: '6px',
            }}
          >
            <DashboardIcon name="file-text" size={14} />
            <span>Print Prescription</span>
          </button>
        </div>
      </div>

      {/* Main Publication-Grade Prescription Sheet */}
      <div
        className="prescription-sheet"
        style={{
          maxWidth: '1020px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '2.5rem',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: '#0f172a',
          lineHeight: '1.5',
        }}
      >
        {/* ======================================================== */}
        {/* PAGE 1: CLINICAL HEADER, DEMOGRAPHICS & TARGETS         */}
        {/* ======================================================== */}
        <div className="prescription-page-1">
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '3px solid #1b4332',
              paddingBottom: '1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '10px',
                  backgroundColor: '#1b4332',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1.5rem',
                  letterSpacing: '-0.02em',
                }}
              >
                AD
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#1b4332', letterSpacing: '-0.02em' }}>
                  AYURDIET CLINICAL NUTRITION CENTER
                </h1>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#2d6a4f' }}>
                  Integrative Ayurvedic Dietetics &amp; Precision Clinical Nutrition
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Reg: AYUR-ND-2026/0488 • Dhanvantari Marg, New Delhi 110001 • Ph: +91 (11) 2894-3320 • clinical@ayurdiet.org
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '220px' }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: isApproved ? '#dcfce7' : '#fef3c7',
                  color: isApproved ? '#166534' : '#b45309',
                  border: `1px solid ${isApproved ? '#86efac' : '#fde68a'}`,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: '0.35rem',
                }}
              >
                {isApproved ? 'Official Approved Prescription' : 'Unapproved Clinical Draft'}
              </span>
              <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                Prescription ID: <strong>{dietPlan?.plan_id || `DP-${dietPlan?.id || '101'}`}</strong>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                Issued Date: <strong>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              </div>
              {isApproved && dietPlan?.approved_at && (
                <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '0.15rem' }}>
                  Locked: {new Date(dietPlan.approved_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Patient Demographic & Clinical Identification Box */}
          <div
            className="avoid-break"
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1b4332', marginBottom: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Patient Demographics &amp; Metabolic Baseline
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Patient Name: </span>
                <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{pName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Patient ID: </span>
                <strong>{pCode}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Age / Sex: </span>
                <strong>{pAge} yrs / {pSex}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Anthropometrics: </span>
                <strong>{pHeight} cm | {pWeight} kg (BMI: {pBmi})</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Ayurvedic Prakriti: </span>
                <strong style={{ color: '#1b4332' }}>{pPrakriti}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Agni (Digestive Fire): </span>
                <strong>{pAgni}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Primary Nutrition Goal: </span>
                <strong style={{ textTransform: 'capitalize' }}>{pGoal}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Food Allergies: </span>
                <strong style={{ color: pAllergies.length ? '#dc2626' : '#334155' }}>
                  {Array.isArray(pAllergies) && pAllergies.length ? pAllergies.join(', ') : 'None Reported'}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 1: Clinical Assessment & Strategy */}
          <div className="avoid-break" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#1b4332', fontWeight: 700, margin: '0 0 0.4rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem' }}>
              1. CLINICAL ASSESSMENT &amp; THERAPEUTIC NUTRITION STRATEGY
            </h3>
            <p style={{ fontSize: '0.83rem', color: '#334155', lineHeight: '1.5', margin: '0 0 0.6rem' }}>
              {dietPlan?.patient_summary || 'Comprehensive clinical assessment conducted under integrative Ayurvedic and clinical nutritional guidelines.'}
            </p>
            <div style={{ backgroundColor: '#f0fdf4', borderLeft: '3.5px solid #2d6a4f', padding: '0.65rem 0.95rem', borderRadius: '4px', fontSize: '0.82rem', color: '#1b4332' }}>
              <strong>Dietary Rationale: </strong>
              {dietPlan?.clinical_rationale || 'Targeted macronutrient balancing with authentic dosha-pacifying staple rotations to support Agni, optimize metabolic clearance, and maintain glycemic stability.'}
            </div>

            {/* Section 9 Lab Insights Table */}
            {labSummary && labSummary.total_tests_analyzed > 0 && (
              <div style={{ marginTop: '0.85rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.35rem' }}>
                  Section 9 Laboratory Biomarkers ({labSummary.total_tests_analyzed} Tests Analyzed • {labSummary.abnormal_count || 0} Flagged)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Test Name</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Observed Value</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Reference Range</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Clinical Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(labSummary.items || []).slice(0, 8).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{item.test_name}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>{item.observed_value} {item.unit}</td>
                        <td style={{ padding: '0.35rem 0.6rem', color: '#64748b' }}>{item.reference_range || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              color: item.status === 'normal' ? '#16a34a' : '#dc2626',
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {labSummary.critical_alerts?.length > 0 && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '0.76rem', color: '#991b1b' }}>
                    <strong>CLINICAL ALERT: </strong>
                    {labSummary.critical_alerts.map((a) => a.message).join('; ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Nutrition Targets Comparison */}
          <div className="avoid-break" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#1b4332', fontWeight: 700, margin: '0 0 0.4rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem' }}>
              2. PRESCRIBED DAILY NUTRITIONAL TARGETS &amp; PLAN AVERAGES
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                  <th style={{ padding: '0.45rem', textAlign: 'left' }}>Parameter</th>
                  <th style={{ padding: '0.45rem' }}>Energy (kcal)</th>
                  <th style={{ padding: '0.45rem' }}>Protein (g)</th>
                  <th style={{ padding: '0.45rem' }}>Carbohydrates (g)</th>
                  <th style={{ padding: '0.45rem' }}>Total Fats (g)</th>
                  <th style={{ padding: '0.45rem' }}>Fiber (g)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.4rem', textAlign: 'left', fontWeight: 600 }}>Deterministic Target</td>
                  <td style={{ padding: '0.4rem', fontWeight: 700, color: '#1b4332' }}>{targetCals}</td>
                  <td style={{ padding: '0.4rem' }}>{targetProt}</td>
                  <td style={{ padding: '0.4rem' }}>{targetCarb}</td>
                  <td style={{ padding: '0.4rem' }}>{targetFat}</td>
                  <td style={{ padding: '0.4rem' }}>25 - 35</td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.4rem', textAlign: 'left', fontWeight: 600 }}>7-Day Actual Average</td>
                  <td style={{ padding: '0.4rem', fontWeight: 700, color: '#15803d' }}>{avgCals}</td>
                  <td style={{ padding: '0.4rem' }}>{avgProt}</td>
                  <td style={{ padding: '0.4rem' }}>{avgCarb}</td>
                  <td style={{ padding: '0.4rem' }}>{avgFat}</td>
                  <td style={{ padding: '0.4rem' }}>{avgFiber}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem', fontStyle: 'italic' }}>
              * Formulated based on ICMR-NIN 2020 RDA guidelines and validated against IFCT food composition data.
            </div>
          </div>
        </div>

        {/* Clear Page Break after Page 1 */}
        <div className="page-break" style={{ height: '1px', borderBottom: '1px dashed #cbd5e1', margin: '2rem 0' }} />

        {/* ======================================================== */}
        {/* SUBSEQUENT PAGES: COMPLETE SEVEN-DAY MEAL SCHEDULE      */}
        {/* ======================================================== */}
        <div className="prescription-schedule" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.05rem', color: '#1b4332', fontWeight: 800, margin: '0 0 0.85rem', borderBottom: '2.5px solid #1b4332', paddingBottom: '0.4rem' }}>
            3. COMPLETE SEVEN-DAY PRESCRIBED MEAL SCHEDULE (MONDAY — SUNDAY)
          </h2>

          {days.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
              No meal days generated yet.
            </div>
          ) : (
            days.map((day, dIdx) => (
              <div
                key={day.day_number || dIdx}
                className="avoid-break"
                style={{
                  marginBottom: '1.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                {/* Day Header Banner */}
                <div
                  style={{
                    backgroundColor: '#1b4332',
                    color: '#ffffff',
                    padding: '0.65rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.02em' }}>
                    DAY {day.day_number}: {day.day_name?.toUpperCase()} — <span style={{ fontWeight: 500, color: '#b7e4c7' }}>{day.theme}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#d8f3dc' }}>
                    Daily Totals: <strong>{day.daily_totals?.calories} kcal</strong> | P: {day.daily_totals?.protein_g}g | C: {day.daily_totals?.carbohydrate_g}g | F: {day.daily_totals?.fat_g}g
                  </div>
                </div>

                {/* Professional Tabular Grid for Day's Meals */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155', textAlign: 'left' }}>
                      <th style={{ padding: '0.45rem 0.75rem', width: '18%' }}>Meal &amp; Timing</th>
                      <th style={{ padding: '0.45rem 0.75rem', width: '30%' }}>Food Item &amp; Portion</th>
                      <th style={{ padding: '0.45rem 0.75rem', width: '30%' }}>Cooking &amp; Ayurvedic Notes</th>
                      <th style={{ padding: '0.45rem 0.5rem', width: '8%', textAlign: 'center' }}>Energy</th>
                      <th style={{ padding: '0.45rem 0.4rem', width: '4.5%', textAlign: 'center' }}>P (g)</th>
                      <th style={{ padding: '0.45rem 0.4rem', width: '4.5%', textAlign: 'center' }}>C (g)</th>
                      <th style={{ padding: '0.45rem 0.5rem', width: '5%', textAlign: 'center' }}>F (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(day.meals || []).map((meal, mIdx) => (
                      <React.Fragment key={meal.meal_id || mIdx}>
                        {/* Meal Group Banner Row */}
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: mIdx > 0 ? '1px solid #cbd5e1' : 'none' }}>
                          <td
                            colSpan={7}
                            style={{
                              padding: '0.4rem 0.75rem',
                              fontWeight: 700,
                              color: '#1b4332',
                              fontSize: '0.8rem',
                              textTransform: 'capitalize',
                            }}
                          >
                            • {meal.meal_type?.replace(/_/g, ' ')} <span style={{ fontWeight: 500, color: '#64748b' }}>({meal.timing || 'Appropriate Hours'})</span>
                            <span style={{ float: 'right', fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>
                              Subtotal: {meal.totals?.calories} kcal | {meal.totals?.protein_g}g Protein
                            </span>
                          </td>
                        </tr>

                        {/* Foods in Meal */}
                        {(meal.foods || []).map((food, fIdx) => (
                          <tr
                            key={fIdx}
                            style={{
                              borderBottom: fIdx === (meal.foods?.length || 0) - 1 ? 'none' : '1px solid #f1f5f9',
                              backgroundColor: fIdx % 2 === 1 ? '#fafafa' : '#ffffff',
                            }}
                          >
                            <td style={{ padding: '0.4rem 0.75rem', color: '#64748b', fontSize: '0.74rem' }}>
                              {fIdx === 0 ? (meal.timing || '—') : ''}
                            </td>
                            <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                              {food.food_name} — <span style={{ color: '#2d6a4f', fontWeight: 500 }}>{food.quantity} {food.unit}</span>
                            </td>
                            <td style={{ padding: '0.4rem 0.75rem', color: '#475569', fontSize: '0.75rem', fontStyle: 'italic', lineHeight: '1.4' }}>
                              {food.preparation_notes || food.ayurvedic_properties || 'Freshly prepared, warm.'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600, color: '#1b4332' }}>
                              {food.calories} kcal
                            </td>
                            <td style={{ padding: '0.4rem 0.4rem', textAlign: 'center', color: '#334155' }}>
                              {food.protein_g}
                            </td>
                            <td style={{ padding: '0.4rem 0.4rem', textAlign: 'center', color: '#334155' }}>
                              {food.carbohydrate_g}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: '#334155' }}>
                              {food.fat_g}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Day Totals Summary Row */}
                    <tr style={{ backgroundColor: '#f0fdf4', borderTop: '1.5px solid #1b4332', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '0.5rem 0.75rem', color: '#1b4332', textAlign: 'left' }}>
                        DAY {day.day_number} TOTAL DAILY INTAKE
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#166534' }}>
                        {day.daily_totals?.calories} kcal
                      </td>
                      <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#166534' }}>
                        {day.daily_totals?.protein_g}g
                      </td>
                      <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#166534' }}>
                        {day.daily_totals?.carbohydrate_g}g
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#166534' }}>
                        {day.daily_totals?.fat_g}g
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {/* ======================================================== */}
        {/* FINAL SECTION: PRINCIPLES, PRECAUTIONS & SIGN-OFF       */}
        {/* ======================================================== */}
        <div className="prescription-closing">
          {/* Section 4: Ayurvedic Principles */}
          <div className="avoid-break" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#1b4332', fontWeight: 700, margin: '0 0 0.4rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem' }}>
              4. AYURVEDIC DIETARY PRINCIPLES (AHARA VIDHI VIDHANA)
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#334155', lineHeight: '1.55' }}>
              {(dietPlan?.ayurvedic_dietary_principles || [
                'Ahara Vidhi: Consume freshly prepared, warm meals in a tranquil, distraction-free atmosphere.',
                'Shad Rasa Satmya: Ensure all six primary tastes (Madhura, Amla, Lavana, Katu, Tikta, Kashaya) are harmonized daily.',
                'Agni Rakshana: Maintain a structured 3.5 to 4-hour interval between primary meals to allow complete digestion.',
                'Matravat Ahara: Eat until 3/4 full capacity (2 parts solid, 1 part liquid, 1 part space for dosha circulation).',
              ]).map((p, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>{p}</li>
              ))}
            </ul>
          </div>

          {/* Section 5: Clinical Precautions & Lifestyle */}
          <div className="avoid-break" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#1b4332', fontWeight: 700, margin: '0 0 0.4rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem' }}>
              5. GENERAL CLINICAL PRECAUTIONS &amp; LIFESTYLE ADVICE
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#334155', lineHeight: '1.55' }}>
              {(dietPlan?.general_instructions || [
                'Hydration: Sip warm or room-temperature water throughout the day. Avoid iced beverages during or immediately after meals.',
                'Meal Timing: Conclude dinner at least 2.5 to 3 hours prior to sleeping to avoid sluggish digestion (Ama formation).',
                'Physical Activity: Perform a relaxed 100-step stroll (Shatapadi) following primary meals to aid gastric transit.',
              ]).map((ins, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>{ins}</li>
              ))}
            </ul>
          </div>

          {/* Section 6: Clinician Sign-off & Legal Stamp */}
          <div
            className="avoid-break"
            style={{
              borderTop: '2px solid #1b4332',
              paddingTop: '1.25rem',
              marginTop: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#1b4332', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                PRESCRIBING CLINICIAN SIGN-OFF
              </div>
              <div style={{ fontSize: '0.86rem' }}>
                Clinician Name: <strong>{dietPlan?.approved_by || 'Dr. Vaidya (Registered Clinical Dietitian)'}</strong>
              </div>
              <div>
                Designation: <strong>Senior Ayurvedic Clinical Nutritionist</strong>
              </div>
              <div>
                Clinic: <strong>AyurDiet Integrative Health Center</strong>
              </div>
              <div style={{ marginTop: '0.4rem', color: '#15803d', fontWeight: 600 }}>
                Status: {isApproved ? '✓ Clinically Verified & Officially Locked' : '⚠ Draft Regimen — Pending Sign-off'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ height: '40px' }}></div>
              <div style={{ borderTop: '1px solid #94a3b8', width: '220px', marginLeft: 'auto', marginBottom: '0.25rem' }}></div>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                Authorized Practitioner Signature &amp; Stamp
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                AYUR-REG-2026-DEL • Date: {new Date().toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>

          {/* Legal Medical Disclaimer */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #e2e8f0',
              fontSize: '0.7rem',
              color: '#64748b',
              textAlign: 'center',
              lineHeight: '1.4',
            }}
          >
            <strong>CONFIDENTIAL MEDICAL NUTRITION DOCUMENT: </strong>
            This clinical diet prescription is prepared based on classical Ayurvedic principles and validated against ICMR-NIN nutritional standards. It is intended solely for the named patient. Please adhere to prescribed portions and meal timings. For clinical queries or follow-up consultations, please contact your prescribing practitioner.
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* WHATSAPP PRESCRIPTION DISPATCH MODAL                     */}
      {/* ======================================================== */}
      {showWhatsAppModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  <DashboardIcon name="whatsapp" size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1b4332' }}>
                    Send Prescription via WhatsApp
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Patient: <strong>{pName}</strong> ({pCode})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div>
              {/* Phone Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Patient Mobile Number (with Country Code)
                </label>
                <input
                  type="text"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  placeholder="+91 98765 43210 or 10-digit mobile number"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Supports 10-digit Indian numbers (auto-prefixes +91) and international E.164 formats (+1, +44, etc.).
                </div>
              </div>

              {/* Consent Checkbox */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.85rem',
                  marginBottom: '1.25rem',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: '#334155', lineHeight: '1.45' }}>
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Clinical &amp; Privacy Consent Confirmation:</strong> I confirm that the patient has provided explicit consent to receive their clinical diet prescription, nutritional summary, and authorized download link via WhatsApp.
                  </span>
                </label>
              </div>

              {/* Error Banner */}
              {whatsAppError && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    color: '#991b1b',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                  }}
                >
                  ⚠ {whatsAppError}
                </div>
              )}

              {/* Result Banner: Cloud API */}
              {whatsAppResult && whatsAppResult.delivery_method === 'cloud_api' && (
                <div
                  style={{
                    padding: '0.85rem',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    color: '#166534',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>
                    ✓ Prescription Dispatched via WhatsApp Business Cloud API!
                  </div>
                  <div>Recipient: <strong>{whatsAppResult.masked_phone}</strong></div>
                  <div>Message ID: <code style={{ fontSize: '0.75rem' }}>{whatsAppResult.message_id}</code></div>
                </div>
              )}

              {/* Result Banner: Fallback wa.me link */}
              {whatsAppResult && whatsAppResult.delivery_method === 'manual_fallback' && (
                <div
                  style={{
                    padding: '0.85rem',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #93c5fd',
                    borderRadius: '6px',
                    color: '#1e40af',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#1d4ed8' }}>
                    📋 WhatsApp Prescription Prepared for Manual Clinical Review
                  </div>
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.78rem', color: '#3b82f6' }}>
                    Recipient: <strong>{whatsAppResult.masked_phone}</strong> • Status: Ready
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <a
                      href={whatsAppResult.fallback_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        backgroundColor: '#25D366',
                        borderColor: '#128C7E',
                        color: '#ffffff',
                        fontSize: '0.84rem',
                        padding: '0.55rem 1.15rem',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                      }}
                    >
                      <DashboardIcon name="whatsapp" size={16} />
                      <span>Open WhatsApp Web / Chat</span>
                    </a>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                    Clicking opens the WhatsApp conversation with the clinical greeting, nutrition targets, and authorized PDF download link pre-filled for your review before sending.
                  </div>
                </div>
              )}

              {/* Recent Dispatch History */}
              {whatsAppHistory.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Past WhatsApp Dispatches for This Prescription
                  </div>
                  <div style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '0.75rem', color: '#475569' }}>
                    {whatsAppHistory.map((h, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed #f1f5f9' }}>
                        <span>{h.masked_phone} ({h.delivery_method})</span>
                        <span style={{ color: h.status === 'sent' ? '#16a34a' : '#0284c7', fontWeight: 600 }}>
                          {h.status} • {new Date(h.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowWhatsAppModal(false)}
                style={{ fontSize: '0.84rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp || !consentConfirmed}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.84rem',
                  padding: '0.5rem 1.25rem',
                  backgroundColor: !consentConfirmed ? '#94a3b8' : '#25D366',
                  borderColor: !consentConfirmed ? '#94a3b8' : '#128C7E',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: !consentConfirmed || sendingWhatsApp ? 'not-allowed' : 'pointer',
                  borderRadius: '6px',
                }}
              >
                <DashboardIcon name="send" size={14} />
                <span>{sendingWhatsApp ? 'Dispatching...' : 'Dispatch Prescription'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
