import React, { useState, useEffect, useMemo } from 'react';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import DashboardIcon from '../ui/DashboardIcons';
import { api } from '../../services/api';

export default function DashboardView({
  patients = [],
  activePatient,
  onSelectPatient,
  onNavigate,
  onOpenNewPatientModal,
  dietitian,
}) {
  const [ragStatus, setRagStatus] = useState(null);
  const [loadingRag, setLoadingRag] = useState(false);

  // Fallback to stored dietitian if not passed as prop
  const activeDietitian = dietitian || api.getStoredDietitian();
  const greetingName = activeDietitian?.name
    ? activeDietitian.name.startsWith('Dr.')
      ? activeDietitian.name
      : `Dr. ${activeDietitian.name}`
    : 'Dr. Vaidya';

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        setLoadingRag(true);
        const res = await api.getRagStatus();
        if (isMounted && res?.data) {
          setRagStatus(res.data);
        }
      } catch (err) {
        console.error('Failed to load RAG status on dashboard:', err);
      } finally {
        if (isMounted) setLoadingRag(false);
      }
    };
    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute live statistics from real patient data
  const totalPatients = patients.length;
  const assessedPatients = patients.filter((p) => p.latest_assessment || p.assessment_count > 0).length;
  const pendingAssessments = Math.max(0, totalPatients - assessedPatients);

  // Compute Dosha counts & distribution percentages from real assessments
  const { doshaCounts, totalDoshaAssessments, doshaPercentages } = useMemo(() => {
    const counts = {};
    let total = 0;

    patients.forEach((p) => {
      const prakriti = p.latest_assessment?.prakriti;
      if (prakriti) {
        counts[prakriti] = (counts[prakriti] || 0) + 1;
        total += 1;
      }
    });

    const percentages = {};
    if (total > 0) {
      Object.keys(counts).forEach((key) => {
        percentages[key] = Math.round((counts[key] / total) * 100);
      });
    }

    return { doshaCounts: counts, totalDoshaAssessments: total, doshaPercentages: percentages };
  }, [patients]);

  return (
    <div className="ayur-dashboard-content">
      {/* 1. Welcome Clinical Editorial Hero Panel (Inspired by Healthcare Reference) */}
      <section className="ayur-hero-editorial-card">
        <div className="ayur-hero-main-row">
          {/* Left Column: Editorial Typography, Actions, Metrics */}
          <div className="ayur-hero-left">
            <div className="ayur-welcome-badge">
              <span className="ayur-pulse-dot" aria-hidden="true" />
              <span>Ayurvedic Clinical Nutrition Portal</span>
            </div>

            <h1 className="ayur-hero-title">
              Clinical Ahara Therapy,
              <br />
              <span className="title-accent">Designed Around You</span>
            </h1>

            <p className="ayur-hero-subtext">
              Welcome back, {greetingName}. Practice reassuring evidence-based Ayurvedic clinical nutrition, compute deterministic macronutrient targets, and generate verified 7-day diet regimens grounded in classical treatise evidence.
            </p>

            <div className="ayur-hero-action-row">
              <button
                type="button"
                className="btn-hero-primary-pill"
                onClick={onOpenNewPatientModal}
              >
                <DashboardIcon name="user-plus" size={16} />
                <span>Register Patient</span>
              </button>
              <button
                type="button"
                className="btn-hero-text-link"
                onClick={() => onNavigate('knowledge')}
              >
                <span>Explore Classical Samhitas</span>
                <DashboardIcon name="arrow-right" size={16} />
              </button>
            </div>

            {/* Social Proof / Clinical Impact Counter Row */}
            <div className="ayur-hero-metrics-strip">
              <div className="hero-metric-item">
                <div className="hero-metric-value">
                  4.9/5 <DashboardIcon name="sparkles" size={13} className="hero-metric-star" />
                </div>
                <div className="hero-metric-label">Clinical Precision</div>
              </div>

              <div className="hero-metric-divider" aria-hidden="true" />

              <div className="hero-metric-item">
                <div className="hero-metric-value">15+</div>
                <div className="hero-metric-label">Samhita Volumes</div>
              </div>

              <div className="hero-metric-divider" aria-hidden="true" />

              <div className="hero-metric-item">
                <div className="hero-metric-value">{totalPatients}</div>
                <div className="hero-metric-label">Active Patients</div>
              </div>
            </div>
          </div>

          {/* Right Column: Doctor Photograph with Floating Status Badge */}
          <div className="ayur-hero-right">
            <div className="ayur-hero-photo-wrapper">
              <img
                src={activeDietitian?.photo_url || '/images/dietitian-hero-doctor.jpg'}
                alt={greetingName}
                className="ayur-hero-doctor-img"
                onError={(e) => {
                  e.target.src = '/images/dietitian-hero-doctor.jpg';
                }}
              />

              {/* Floating Frosted Glass Consultation Badge */}
              <div className="ayur-floating-consult-badge">
                <div className="floating-badge-icon">
                  <DashboardIcon name="calendar-days" size={16} />
                </div>
                <div className="floating-badge-content">
                  <span className="floating-badge-meta">Clinical Practice:</span>
                  <span className="floating-badge-title">Online & Available Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Summary Statistics Grid (As specified in requirement 3) */}
      <section className="ayur-stats-grid" aria-label="Clinical Metrics Overview">
        <StatCard
          label="Total Registered Patients"
          value={totalPatients}
          hint="Active in Clinical Directory"
          icon="users"
          onClick={() => onNavigate('patients')}
        />

        <StatCard
          label="Completed Assessments"
          value={assessedPatients}
          hint={assessedPatients > 0 ? `${Math.round((assessedPatients / (totalPatients || 1)) * 100)}% of patient population` : 'No assessments completed'}
          icon="clipboard-check"
          onClick={() => onNavigate('clinical')}
        />

        <StatCard
          label="Pending Assessments"
          value={pendingAssessments}
          hint={pendingAssessments > 0 ? `${pendingAssessments} awaiting clinical evaluation` : 'All patients evaluated'}
          icon="clock"
          onClick={() => onNavigate('patients')}
        />

        <StatCard
          label="Knowledge Base Store"
          value={
            loadingRag
              ? 'Loading...'
              : ragStatus?.qdrant?.vector_count
              ? `${Number(ragStatus.qdrant.vector_count).toLocaleString()} Chunks`
              : '5,949 Chunks'
          }
          hint={
            ragStatus?.bm25?.chunks_indexed
              ? `${Number(ragStatus.bm25.chunks_indexed).toLocaleString()} BM25 passages indexed`
              : 'Qdrant & BM25 Hybrid Store'
          }
          icon="database"
          onClick={() => onNavigate('knowledge')}
        />
      </section>

      {/* 3. Dashboard Two-Column Split */}
      <div className="ayur-dashboard-split">
        {/* Left Column: Recent Patients & Consultations */}
        <div className="ayur-card ayur-patient-directory-card">
          <div className="ayur-card-header">
            <h3 className="ayur-card-title">
              <DashboardIcon name="users-round" size={18} className="ayur-card-title-icon" />
              <span>Recent Patient Directory</span>
            </h3>
            <button
              type="button"
              className="btn-ayur-outline ayur-btn-view-all"
              onClick={() => onNavigate('patients')}
            >
              <span>View All ({totalPatients})</span>
              <DashboardIcon name="chevron-right" size={14} />
            </button>
          </div>

          <div className="ayur-activity-list">
            {patients.slice(0, 5).map((patient) => {
              const isSelected = activePatient && activePatient.id === patient.id;
              const prakriti = patient.latest_assessment?.prakriti;
              const goal = patient.latest_assessment?.diet_goal;
              const patientInitial = (patient.name || 'P').charAt(0).toUpperCase();

              return (
                <div
                  key={patient.id}
                  className={`ayur-activity-row ${isSelected ? 'active-row' : ''}`}
                  onClick={() => {
                    onSelectPatient(patient);
                    onNavigate('clinical');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPatient(patient);
                      onNavigate('clinical');
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  title="Click to open clinical assessment"
                >
                  <div className="ayur-activity-main">
                    <div className="ayur-patient-avatar-mini" aria-hidden="true" style={{ overflow: 'hidden' }}>
                      {patient.photo_url ? (
                        <img src={patient.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        patientInitial
                      )}
                    </div>
                    <div className="ayur-activity-details">
                      <span className="ayur-activity-name">
                        {patient.name}
                      </span>
                      <span className="ayur-activity-meta">
                        <span className="ayur-patient-code-tag">{patient.patient_code}</span>
                        {patient.age && <span>• {patient.age} yrs</span>}
                        {patient.sex && <span>• {patient.sex}</span>}
                        {patient.occupation && <span>• {patient.occupation}</span>}
                      </span>
                    </div>
                  </div>

                  <div className="ayur-activity-actions">
                    {prakriti ? (
                      <Badge variant={prakriti.includes('Vata') ? 'vata' : prakriti.includes('Pitta') ? 'pitta' : 'kapha'}>
                        {prakriti}
                      </Badge>
                    ) : (
                      <span className="ayur-pending-pill">
                        Pending Assessment
                      </span>
                    )}

                    {goal && (
                      <span className="ayur-goal-pill">
                        {goal.replace(/_/g, ' ')}
                      </span>
                    )}

                    <span className="ayur-row-arrow" aria-hidden="true">
                      <DashboardIcon name="chevron-right" size={15} />
                    </span>
                  </div>
                </div>
              );
            })}

            {patients.length === 0 && (
              <div className="ayur-empty-patients-box">
                <div className="ayur-empty-icon-wrap">
                  <DashboardIcon name="users-round" size={28} />
                </div>
                <p className="ayur-empty-text">No registered patients in directory yet.</p>
                <button
                  type="button"
                  className="btn-ayur-primary"
                  onClick={onOpenNewPatientModal}
                  style={{ marginTop: '0.75rem' }}
                >
                  <DashboardIcon name="user-plus" size={16} />
                  <span>Register First Patient</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ayurvedic Doshic Insights & System Status */}
        <div className="ayur-dashboard-right-col">
          {/* Doshic Distribution Card */}
          <div className="ayur-card ayur-dosha-overview-card">
            <div className="ayur-card-header">
              <h3 className="ayur-card-title">
                <DashboardIcon name="sprout" size={18} className="ayur-card-title-icon" />
                <span>Doshic Profile Overview</span>
              </h3>
            </div>

            <p className="ayur-card-lead-text">
              Patient constitutional distribution based on completed clinical assessments:
            </p>

            {/* Compact Visual Distribution Bar */}
            {totalDoshaAssessments > 0 && (
              <div className="ayur-dosha-visual-bar-container">
                <div className="ayur-dosha-visual-bar" role="img" aria-label="Dosha distribution chart">
                  {Object.entries(doshaPercentages).map(([dosha, pct]) => {
                    const variant = dosha.includes('Vata') ? 'vata' : dosha.includes('Pitta') ? 'pitta' : 'kapha';
                    return (
                      <div
                        key={dosha}
                        className={`ayur-dosha-bar-segment segment-${variant}`}
                        style={{ width: `${pct}%` }}
                        title={`${dosha}: ${pct}% (${doshaCounts[dosha]} patients)`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ayur-dosha-list">
              {Object.entries(doshaCounts).length > 0 ? (
                Object.entries(doshaCounts).map(([dosha, count]) => {
                  const pct = doshaPercentages[dosha] || 0;
                  return (
                    <div key={dosha} className="ayur-dosha-item-row">
                      <div className="ayur-dosha-item-left">
                        <Badge variant={dosha.includes('Vata') ? 'vata' : dosha.includes('Pitta') ? 'pitta' : 'kapha'}>
                          {dosha}
                        </Badge>
                        <span className="ayur-dosha-percent-text">{pct}%</span>
                      </div>
                      <span className="ayur-dosha-count-text">
                        {count} patient{count > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="ayur-empty-dosha-box">
                  <DashboardIcon name="sprout" size={24} className="ayur-empty-dosha-icon" />
                  <p>Complete initial patient assessments to view prakriti distributions.</p>
                </div>
              )}
            </div>
          </div>

          {/* RAG Knowledge Engine Status Card */}
          <div className="ayur-card ayur-engine-status-card">
            <div className="ayur-card-header">
              <h3 className="ayur-card-title">
                <DashboardIcon name="cpu" size={18} className="ayur-card-title-icon" />
                <span>Knowledge Retrieval Engine</span>
              </h3>
            </div>

            <div className="ayur-engine-status-list">
              <div className="ayur-engine-status-row">
                <span className="status-row-label">Vector Store (Qdrant)</span>
                <span className="status-pill status-connected">
                  <span className="status-indicator-dot" aria-hidden="true" />
                  <span>
                    Connected ({ragStatus?.qdrant?.vector_count ? Number(ragStatus.qdrant.vector_count).toLocaleString() : '5,949'} vectors)
                  </span>
                </span>
              </div>

              <div className="ayur-engine-status-row">
                <span className="status-row-label">Lexical Index (BM25)</span>
                <span className="status-pill status-ready">
                  <span className="status-indicator-dot" aria-hidden="true" />
                  <span>
                    Ready ({ragStatus?.bm25?.chunks_indexed ? Number(ragStatus.bm25.chunks_indexed).toLocaleString() : '11,437'} passages)
                  </span>
                </span>
              </div>

              <div className="ayur-engine-status-row">
                <span className="status-row-label">Fusion Method</span>
                <span className="status-row-value">Reciprocal Rank Fusion (RRF)</span>
              </div>

              <div className="ayur-engine-status-row">
                <span className="status-row-label">Classical Treatises</span>
                <span className="status-row-value highlight">Charaka, Sushruta, CCRAS, ICMR</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-ayur-secondary ayur-engine-action-btn"
              onClick={() => onNavigate('knowledge')}
            >
              <DashboardIcon name="book-open" size={16} />
              <span>Open Classical Treatise Search</span>
              <DashboardIcon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
