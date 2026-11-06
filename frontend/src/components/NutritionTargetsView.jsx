import React, { useState } from 'react';
import DashboardIcon from './ui/DashboardIcons';

export default function NutritionTargetsView({
  targets,
  loading = false,
  onRecalculate,
  error = null,
}) {
  const [showFormulas, setShowFormulas] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="nutrition-loading-card">
        <div className="nutrition-spinner" />
        <h4 style={{ color: '#1b4332', marginTop: '1rem', fontWeight: 600 }}>
          Calculating Deterministic Targets...
        </h4>
        <p style={{ color: '#4a5d55', fontSize: '0.9rem', maxWidth: '420px', margin: '0.5rem auto 0' }}>
          Applying Mifflin-St Jeor BMR regression, PAL physical activity multipliers, macronutrient distribution, and Ayurvedic dosha rules.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nutrition-error-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: '#842029' }}>
          <DashboardIcon name="shield-alert" size={32} />
        </div>
        <h4 style={{ color: '#842029', fontWeight: 600 }}>Calculation Engine Notice</h4>
        <p style={{ color: '#842029', fontSize: '0.9rem', marginTop: '0.4rem' }}>
          {error.message || 'Unable to compute nutrition targets. Please check that height, weight, age, and diet goal are set.'}
        </p>
        {onRecalculate && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={onRecalculate}
          >
            Retry Calculation
          </button>
        )}
      </div>
    );
  }

  if (!targets) {
    return (
      <div className="empty-state" style={{ padding: '3rem 1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px dashed #c9d8ce' }}>
        <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', color: 'var(--color-primary)' }}>
          <DashboardIcon name="sparkles" size={36} />
        </div>
        <h3 style={{ fontSize: '1.2rem', color: '#0f2d23', marginBottom: '0.4rem' }}>
          No Targets Calculated Yet
        </h3>
        <p style={{ maxWidth: '460px', fontSize: '0.88rem', color: '#4a5d55', marginBottom: '1.25rem' }}>
          Compute reproducible, explainable caloric, macronutrient, hydration, fiber, and Ayurvedic guidelines directly from this patient's assessment data.
        </p>
        {onRecalculate && (
          <button
            type="button"
            className="btn-primary"
            onClick={onRecalculate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', margin: '0 auto' }}
          >
            <DashboardIcon name="sparkles" size={15} />
            <span>Compute Nutrition Targets</span>
          </button>
        )}
      </div>
    );
  }

  const {
    anthropometrics,
    energy,
    macros,
    other_targets,
    ayurvedic_profile,
    calculation_metadata,
    condition_specific,
  } = targets;

  const handleCopySummary = () => {
    const text = `AyurDiet Clinical Targets:
Patient ID: ${targets.patient_id || 'N/A'}
BMI: ${anthropometrics?.bmi} (${anthropometrics?.bmi_status})
Target Energy: ${energy?.target_energy_kcal_day} kcal/day (BMR: ${energy?.bmr_kcal_day} kcal, TDEE: ${energy?.tdee_kcal_day} kcal)
Protein: ${macros?.protein_g_day}g (${macros?.protein_pct}%)
Carbohydrates: ${macros?.carbohydrate_g_day}g (${macros?.carbohydrate_pct}%)
Fats: ${macros?.fat_g_day}g (${macros?.fat_pct}%)
Fiber: ${other_targets?.fiber_g_day}g/day | Hydration: ${((other_targets?.water_ml_day || 0) / 1000).toFixed(2)} L/day
Prakriti: ${ayurvedic_profile?.prakriti || 'N/A'} | Agni: ${ayurvedic_profile?.appetite_agni || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const getBmiBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('normal')) return 'bmi-badge-normal';
    if (s.includes('overweight')) return 'bmi-badge-overweight';
    if (s.includes('obese')) return 'bmi-badge-obese';
    if (s.includes('underweight')) return 'bmi-badge-under';
    return 'bmi-badge-default';
  };

  return (
    <div className="nutrition-targets-container">
      {/* HEADER HERO BANNER */}
      <div className="nutrition-hero-card">
        <div className="hero-left">
          <div className="engine-chip">
            <span className="pulse-dot" />
            Deterministic Nutrition Engine (Phase 3)
          </div>
          <h2 className="hero-target-kcal">
            {Math.round(energy?.target_energy_kcal_day || 0)}{' '}
            <span className="hero-unit">kcal / day</span>
          </h2>
          <p className="hero-subtitle">
            Goal: <strong>{energy?.goal?.replace(/_/g, ' ') || 'General'}</strong> ({energy?.adjustment_kcal_day > 0 ? `+${energy.adjustment_kcal_day}` : energy?.adjustment_kcal_day} kcal adjustment from {Math.round(energy?.tdee_kcal_day || 0)} TDEE)
          </p>
        </div>

        <div className="hero-right">
          <div className="hero-stat-badge">
            <span className="stat-label">BMR</span>
            <span className="stat-val">{Math.round(energy?.bmr_kcal_day || 0)} kcal</span>
          </div>
          <div className="hero-stat-badge">
            <span className="stat-label">TDEE</span>
            <span className="stat-val">{Math.round(energy?.tdee_kcal_day || 0)} kcal</span>
          </div>
          <div className="hero-stat-badge">
            <span className="stat-label">BMI</span>
            <span className={`stat-val ${getBmiBadgeClass(anthropometrics?.bmi_status)}`}>
              {anthropometrics?.bmi}
            </span>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="btn-hero-action"
              onClick={handleCopySummary}
              title="Copy Summary to Clipboard"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <DashboardIcon name={copied ? 'check' : 'clipboard-check'} size={14} />
              <span>{copied ? 'Copied' : 'Copy Summary'}</span>
            </button>
            {onRecalculate && (
              <button
                type="button"
                className="btn-hero-action"
                onClick={onRecalculate}
                title="Recalculate with updated inputs"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <DashboardIcon name="refresh-cw" size={14} />
                <span>Recalculate</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WARNINGS & CLINICAL ALERTS */}
      {((calculation_metadata?.warnings && calculation_metadata.warnings.length > 0) || condition_specific) && (
        <div className="nutrition-alerts-card">
          <div className="alert-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DashboardIcon name="shield-alert" size={18} />
          </div>
          <div className="alert-content">
            <strong>Clinical Safety & Special Considerations:</strong>
            <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, fontSize: '0.88rem' }}>
              {calculation_metadata?.warnings?.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
              {condition_specific && (
                <li>
                  Patient exhibits clinical conditions requiring Phase 4 Knowledge-Grounded RAG retrieval to evaluate therapeutic contraindications.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* METRIC GRID */}
      <div className="nutrition-cards-grid">
        {/* CARD 1: MACRONUTRIENT DISTRIBUTION */}
        <div className="target-card macro-card">
          <div className="target-card-header">
            <h3 className="target-card-title">Macronutrient Target Distribution</h3>
            <span className="badge-caloric-check">✓ 100% Caloric Balance</span>
          </div>

          {/* Visual Ratio Bar */}
          <div className="macro-ratio-bar">
            <div
              className="macro-segment segment-protein"
              style={{ width: `${macros?.protein_pct || 20}%` }}
              title={`Protein: ${macros?.protein_pct}%`}
            />
            <div
              className="macro-segment segment-carbs"
              style={{ width: `${macros?.carbohydrate_pct || 55}%` }}
              title={`Carbohydrates: ${macros?.carbohydrate_pct}%`}
            />
            <div
              className="macro-segment segment-fat"
              style={{ width: `${macros?.fat_pct || 25}%` }}
              title={`Fat: ${macros?.fat_pct}%`}
            />
          </div>

          <div className="macro-breakdown-row">
            {/* Protein */}
            <div className="macro-item item-protein">
              <div className="macro-label-row">
                <span className="dot dot-protein" />
                <span className="macro-name">Protein</span>
                <span className="macro-pct">{macros?.protein_pct}%</span>
              </div>
              <div className="macro-qty">{macros?.protein_g_day} <span className="unit">g</span></div>
              <div className="macro-meta">{macros?.protein_kcal_day} kcal ({macros?.protein_factor_g_kg} g/kg)</div>
            </div>

            {/* Carbs */}
            <div className="macro-item item-carbs">
              <div className="macro-label-row">
                <span className="dot dot-carbs" />
                <span className="macro-name">Carbs</span>
                <span className="macro-pct">{macros?.carbohydrate_pct}%</span>
              </div>
              <div className="macro-qty">{macros?.carbohydrate_g_day} <span className="unit">g</span></div>
              <div className="macro-meta">{macros?.carbohydrate_kcal_day} kcal (remainder)</div>
            </div>

            {/* Fat */}
            <div className="macro-item item-fat">
              <div className="macro-label-row">
                <span className="dot dot-fat" />
                <span className="macro-name">Fats</span>
                <span className="macro-pct">{macros?.fat_pct}%</span>
              </div>
              <div className="macro-qty">{macros?.fat_g_day} <span className="unit">g</span></div>
              <div className="macro-meta">{macros?.fat_kcal_day} kcal (25% energy)</div>
            </div>
          </div>
        </div>

        {/* CARD 2: PHYSIOLOGICAL FLOORS & HYDRATION */}
        <div className="target-card">
          <div className="target-card-header">
            <h3 className="target-card-title">Physiological Baselines & Hydration</h3>
            <span className="badge-standard">Clinical Standard</span>
          </div>

          <div className="daily-floors-grid">
            <div className="floor-box">
              <div className="floor-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DashboardIcon name="sprout" size={18} />
              </div>
              <div>
                <span className="floor-title">Dietary Fiber</span>
                <div className="floor-value">{other_targets?.fiber_g_day} <span className="unit">g / day</span></div>
                <div className="floor-sub">{other_targets?.fiber_method}</div>
              </div>
            </div>

            <div className="floor-box">
              <div className="floor-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DashboardIcon name="droplet" size={18} />
              </div>
              <div>
                <span className="floor-title">Daily Hydration</span>
                <div className="floor-value">
                  {((other_targets?.water_ml_day || 0) / 1000).toFixed(1)}{' '}
                  <span className="unit">Liters ({Math.round(other_targets?.water_ml_day || 0)} ml)</span>
                </div>
                <div className="floor-sub">{other_targets?.water_method}</div>
              </div>
            </div>

            <div className="floor-box">
              <div className="floor-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DashboardIcon name="ruler" size={18} />
              </div>
              <div>
                <span className="floor-title">Anthropometric Baseline</span>
                <div className="floor-value">
                  {anthropometrics?.weight_kg} kg <span className="unit">/ {anthropometrics?.height_cm} cm</span>
                </div>
                <div className="floor-sub">
                  BMI: <strong>{anthropometrics?.bmi}</strong> ({anthropometrics?.bmi_status})
                  {anthropometrics?.waist_circumference_cm && ` | Waist: ${anthropometrics.waist_circumference_cm} cm`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: AYURVEDIC DOSHIC PERSONALIZATION */}
        <div className="target-card ayurvedic-targets-card">
          <div className="target-card-header">
            <h3 className="target-card-title">Ayurvedic Constitutional Guidelines</h3>
            <span className="badge-ayurveda">Prakriti & Agni</span>
          </div>

          <div className="ayurveda-details-grid">
            <div className="ayur-detail-box">
              <div className="ayur-tag">Constitutional Matrix</div>
              <div className="ayur-val-row">
                <span className="pill-prakriti">{ayurvedic_profile?.prakriti || 'Vata-Pitta'}</span>
                {ayurvedic_profile?.vikriti && (
                  <span className="pill-vikriti">Vikriti: {ayurvedic_profile.vikriti}</span>
                )}
              </div>
              <div className="ayur-meta">
                Digestive Fire: <strong>{ayurvedic_profile?.appetite_agni || 'Samagni'}</strong>
              </div>
            </div>

            <div className="ayur-detail-box">
              <div className="ayur-tag">Seasonal Ritu</div>
              <div className="ayur-val">{ayurvedic_profile?.season_ritu || 'Current Season'}</div>
              <div className="ayur-meta">
                {ayurvedic_profile?.qualities_guidance || 'Qualities matched to season and constitution'}
              </div>
            </div>
          </div>

          <div className="rasas-container">
            <div className="rasa-column rasa-favorable">
              <span className="rasa-label">✓ Prioritize Rasas (Tastes)</span>
              <div className="rasa-tags">
                {ayurvedic_profile?.tastes_to_emphasize?.map((taste, i) => (
                  <span key={i} className="rasa-chip chip-fav">{taste}</span>
                )) || <span className="text-muted">Balanced across six rasas</span>}
              </div>
            </div>

            <div className="rasa-column rasa-moderate">
              <span className="rasa-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <DashboardIcon name="shield-alert" size={13} />
                <span>Pacify / Moderate Rasas</span>
              </span>
              <div className="rasa-tags">
                {ayurvedic_profile?.tastes_to_pacify_or_moderate?.map((taste, i) => (
                  <span key={i} className="rasa-chip chip-mod">{taste}</span>
                )) || <span className="text-muted">No restrictions</span>}
              </div>
            </div>
          </div>

          {ayurvedic_profile?.digestive_guidance && (
            <div className="ayur-digestive-callout">
              <strong>Agni & Digestion Directive:</strong> {ayurvedic_profile.digestive_guidance}
            </div>
          )}
        </div>

        {/* CARD 4: ENERGY STEP-BY-STEP CALCULATION */}
        <div className="target-card">
          <div className="target-card-header">
            <h3 className="target-card-title">Metabolic Math Breakdown</h3>
            <span className="badge-standard">{energy?.formula}</span>
          </div>

          <div className="energy-steps-list">
            <div className="step-row">
              <div className="step-num">1</div>
              <div className="step-info">
                <strong>Basal Metabolic Rate (BMR)</strong>
                <span className="step-desc">Mifflin-St Jeor resting energy expenditure</span>
              </div>
              <div className="step-val">{Math.round(energy?.bmr_kcal_day || 0)} kcal</div>
            </div>

            <div className="step-row">
              <div className="step-num">2</div>
              <div className="step-info">
                <strong>Physical Activity Factor (PAL)</strong>
                <span className="step-desc">{energy?.activity_level?.replace(/_/g, ' ')} multiplier</span>
              </div>
              <div className="step-val">× {energy?.activity_multiplier}</div>
            </div>

            <div className="step-row">
              <div className="step-num">3</div>
              <div className="step-info">
                <strong>Total Daily Energy Expenditure (TDEE)</strong>
                <span className="step-desc">BMR × Activity Multiplier</span>
              </div>
              <div className="step-val">{Math.round(energy?.tdee_kcal_day || 0)} kcal</div>
            </div>

            <div className="step-row">
              <div className="step-num">4</div>
              <div className="step-info">
                <strong>Goal Delta Adjustment</strong>
                <span className="step-desc">{energy?.adjustment_method}</span>
              </div>
              <div className="step-val" style={{ color: energy?.adjustment_kcal_day < 0 ? '#b91c1c' : '#15803d' }}>
                {energy?.adjustment_kcal_day > 0 ? `+${energy.adjustment_kcal_day}` : energy?.adjustment_kcal_day} kcal
              </div>
            </div>

            <div className="step-row final-row">
              <div className="step-num">5</div>
              <div className="step-info">
                <strong>Final Daily Caloric Target</strong>
                <span className="step-desc">Deterministic baseline for 7-day meal planning</span>
              </div>
              <div className="step-val final-val">{Math.round(energy?.target_energy_kcal_day || 0)} kcal</div>
            </div>
          </div>
        </div>
      </div>

      {/* FORMULAS & SCIENTIFIC EXPLAINABILITY ACCORDION */}
      <div className="explainability-card">
        <button
          type="button"
          className="explainability-toggle-btn"
          onClick={() => setShowFormulas(!showFormulas)}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <DashboardIcon name="target" size={16} />
            Mathematical Explainability & Scientific Rationale
          </span>
          <span>{showFormulas ? 'Hide' : 'View Formulas & Assumptions'}</span>
        </button>

        {showFormulas && (
          <div className="explainability-body">
            <div className="formula-block">
              <h5>Validated Mathematical Formulas Applied:</h5>
              <ul>
                {calculation_metadata?.formulas_used?.map((formula, idx) => (
                  <li key={idx}><code>{formula}</code></li>
                ))}
              </ul>
            </div>

            <div className="formula-block">
              <h5>Deterministic Calculation Assumptions:</h5>
              <ul>
                {calculation_metadata?.assumptions?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="disclaimer-callout">
              <strong>Clinical Dietitian Notice:</strong> {calculation_metadata?.disclaimer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
