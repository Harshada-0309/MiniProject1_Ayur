import React, { useState } from 'react';
import MealPlanView from '../MealPlanView';
import DietPlanView from '../DietPlanView';
import Badge from '../ui/Badge';
import { api } from '../../services/api';
import DashboardIcon from '../ui/DashboardIcons';

const AYURVEDIC_DISH_SHOWCASE = [
  {
    name: 'Moong Dal Khichdi',
    image: '/images/meals/khichdi.jpg',
    category: 'Lunch / Therapeutic',
    dosha: 'Tridoshic (Vata, Pitta, Kapha Pacifying)',
    virya: 'Sheeta (Cooling) / Laghu (Light)',
    benefits: 'Easy on Mandagni, detoxifies Ama, ideal mono-diet during digestive restoration.',
  },
  {
    name: 'Dal Tadka & Phulka Thali',
    image: '/images/meals/dal-roti.jpg',
    category: 'Balanced Dinner',
    dosha: 'Pitta & Vata Balancer',
    virya: 'Madhura / Ushna (Digestive)',
    benefits: 'Balanced protein & complex carbs, seasoned with cumin, turmeric, and fresh cilantro.',
  },
  {
    name: 'Spiced Vegetable Poha',
    image: '/images/meals/poha.jpg',
    category: 'Breakfast / Light',
    dosha: 'Kapha & Pitta Friendly',
    virya: 'Laghu (Light) / Dipana (Kindles Agni)',
    benefits: 'Easily digestible flattened rice tempered with mustard seeds, curry leaves, and lemon.',
  },
];

export default function MealPlannerPage({
  activePatient,
  activeAssessment,
  savedMealPlan,
  savedDietPlan,
  onMealPlanSaved,
  onDietPlanSaved,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('meal-plan'); // 'meal-plan' | 'diet-plan' | 'showcase'
  const [loadingMeal, setLoadingMeal] = useState(false);
  const [mealError, setMealError] = useState(null);
  const [savingMeal, setSavingMeal] = useState(false);

  const [loadingDiet, setLoadingDietPlan] = useState(false);
  const [dietError, setDietError] = useState(null);

  // Generate Deterministic Meal Plan
  const handleGenerateMealPlan = async () => {
    if (!activePatient || !activeAssessment) return;
    try {
      setLoadingMeal(true);
      setMealError(null);
      const res = await api.generateMealPlan({
        patient_id: activePatient.id,
        assessment_id: activeAssessment.id,
      });
      const generated = res.data?.meal_plan || res.data;
      if (onMealPlanSaved) onMealPlanSaved(generated);
    } catch (err) {
      console.error('Error generating meal plan:', err);
      setMealError(err.message || 'Failed to generate meal plan');
    } finally {
      setLoadingMeal(false);
    }
  };

  // Save Deterministic Meal Plan
  const handleSaveMealPlan = async (payload) => {
    if (!activePatient) return;
    try {
      setSavingMeal(true);
      const res = await api.saveMealPlan({
        patient_id: activePatient.id,
        assessment_id: activeAssessment?.id,
        ...payload,
      });
      if (onMealPlanSaved) onMealPlanSaved(res.data?.meal_plan || res.data);
    } catch (err) {
      console.error('Error saving meal plan:', err);
      setMealError(err.message || 'Failed to save meal plan');
    } finally {
      setSavingMeal(false);
    }
  };

  // Generate Gemini 7-Day Diet Plan
  const handleGenerateDietPlan = async () => {
    if (!activePatient || !activeAssessment) return;
    try {
      setLoadingDietPlan(true);
      setDietError(null);
      const res = await api.generate7DayDietPlan({
        patient_id: activePatient.id,
        assessment_id: activeAssessment.id,
      });
      const generated = res.data?.diet_plan || res.data;
      if (onDietPlanSaved) onDietPlanSaved(generated);
    } catch (err) {
      console.error('Error generating 7-day diet plan:', err);
      setDietError(err.message || 'Failed to generate 7-day diet plan');
    } finally {
      setLoadingDietPlan(false);
    }
  };

  if (!activePatient) {
    return (
      <div className="ayur-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--color-primary)' }}>
          <DashboardIcon name="utensils" size={44} />
        </div>
        <h3 style={{ fontSize: '1.3rem', color: 'var(--color-deep-slate)', marginBottom: '0.5rem' }}>
          No Active Patient Selected
        </h3>
        <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.9rem', color: 'var(--color-slate-muted)' }}>
          Please select a patient from the directory to review or generate an Ayurvedic daily meal schedule or 7-day diet plan.
        </p>
        <button
          type="button"
          className="btn-ayur-primary"
          onClick={() => onNavigate('patients')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>View Patient Directory</span>
          <DashboardIcon name="arrow-right" size={14} />
        </button>
      </div>
    );
  }

  const prakriti = activeAssessment?.prakriti || activePatient.latest_assessment?.prakriti || 'Assessed';
  const dietGoal = activeAssessment?.diet_goal || activePatient.latest_assessment?.diet_goal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Patient Header Banner */}
      <div className="ayur-card" style={{ padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="ayur-patient-avatar-mini" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
            {activePatient.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-deep-slate)' }}>
                {activePatient.name}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                {activePatient.patient_code}
              </span>
              <Badge variant={prakriti.includes('Vata') ? 'vata' : prakriti.includes('Pitta') ? 'pitta' : 'kapha'}>
                {prakriti}
              </Badge>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-slate-muted)', marginTop: '0.2rem' }}>
              {activePatient.age} yrs • {activePatient.sex} {dietGoal ? `• Goal: ${dietGoal.replace(/_/g, ' ')}` : ''}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: 'var(--color-pearl-white)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('meal-plan')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              backgroundColor: activeTab === 'meal-plan' ? 'var(--color-pure-white)' : 'transparent',
              color: activeTab === 'meal-plan' ? 'var(--color-primary)' : 'var(--color-slate-muted)',
              boxShadow: activeTab === 'meal-plan' ? 'var(--shadow-xs)' : 'none',
              transition: 'all var(--duration-fast)',
            }}
          >
            Daily Meal Plan (Phase 5)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diet-plan')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              backgroundColor: activeTab === 'diet-plan' ? 'var(--color-pure-white)' : 'transparent',
              color: activeTab === 'diet-plan' ? 'var(--color-primary)' : 'var(--color-slate-muted)',
              boxShadow: activeTab === 'diet-plan' ? 'var(--shadow-xs)' : 'none',
              transition: 'all var(--duration-fast)',
            }}
          >
            Gemini 7-Day Plan (Phase 6)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('showcase')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              backgroundColor: activeTab === 'showcase' ? 'var(--color-pure-white)' : 'transparent',
              color: activeTab === 'showcase' ? 'var(--color-primary)' : 'var(--color-slate-muted)',
              boxShadow: activeTab === 'showcase' ? 'var(--shadow-xs)' : 'none',
              transition: 'all var(--duration-fast)',
            }}
          >
            Ayurvedic Dish Showcase
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'meal-plan' && (
        <div className="ayur-card" style={{ padding: '1.75rem' }}>
          <MealPlanView
            mealPlan={savedMealPlan}
            loading={loadingMeal}
            onGeneratePlan={handleGenerateMealPlan}
            onSavePlan={handleSaveMealPlan}
            error={mealError}
            savingPlan={savingMeal}
          />
        </div>
      )}

      {activeTab === 'diet-plan' && (
        <div className="ayur-card" style={{ padding: '1.75rem' }}>
          <DietPlanView
            patient={activePatient}
            existingAssessment={activeAssessment}
            nutritionTargets={savedMealPlan?.nutrition_targets || {}}
            dietPlan={savedDietPlan}
            onGeneratePlan={handleGenerateDietPlan}
            loading={loadingDiet}
            error={dietError}
            onDietPlanUpdated={onDietPlanSaved}
          />
        </div>
      )}

      {activeTab === 'showcase' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-deep-slate)' }}>
              Traditional Ayurvedic Culinary Portfolio
            </h4>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-slate-muted)' }}>
              Wholesome evidence-aligned recipes curated for digestive fire (Agni) and doshic equilibrium (Pathya Ahara).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {AYURVEDIC_DISH_SHOWCASE.map((dish, i) => (
              <div
                key={i}
                className="ayur-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lift)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ height: '210px', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={dish.image}
                    alt={dish.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      backgroundColor: 'rgba(37, 62, 72, 0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {dish.category}
                  </span>
                </div>

                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-deep-slate)' }}>
                    {dish.name}
                  </h4>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', background: 'var(--color-soft-aqua-light)', color: 'var(--color-primary)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 600 }}>
                      {dish.dosha}
                    </span>
                    <span style={{ fontSize: '0.75rem', background: 'var(--color-pearl-white)', border: '1px solid var(--color-border)', color: 'var(--color-slate-muted)', padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
                      {dish.virya}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--color-slate-muted)', lineHeight: 1.5, margin: '0.5rem 0 0' }}>
                    {dish.benefits}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
