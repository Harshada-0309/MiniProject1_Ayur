import React, { useState } from 'react';
import { api } from '../services/api';
import DashboardIcon from './ui/DashboardIcons';

export default function MealPlanView({
  mealPlan,
  loading,
  onGeneratePlan,
  onSavePlan,
  error,
  savingPlan,
}) {
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [selectedFoodForSub, setSelectedFoodForSub] = useState(null);
  const [substitutions, setSubstitutions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subError, setSubError] = useState(null);
  const [expandedReasons, setExpandedReasons] = useState({});
  const [dietitianNotes, setDietitianNotes] = useState('');
  const [activePlan, setActivePlan] = useState(mealPlan);

  // Sync activePlan when mealPlan prop changes (including clearing on patient switch)
  React.useEffect(() => {
    setActivePlan(mealPlan || null);
    setDietitianNotes(mealPlan?.dietitian_notes || '');
  }, [mealPlan]);

  const toggleReason = (foodKey) => {
    setExpandedReasons((prev) => ({
      ...prev,
      [foodKey]: !prev[foodKey],
    }));
  };

  const handleOpenSubstitution = async (mealIndex, food, mealType) => {
    setSelectedFoodForSub({ mealIndex, food, mealType });
    setSubModalOpen(true);
    setLoadingSubs(true);
    setSubError(null);
    try {
      const res = await api.getSubstitutions({
        food_id: food.food_id,
        current_quantity: food.quantity,
        patient_assessment: activePlan?.nutrition_targets || {},
        meal_type: mealType,
      });
      setSubstitutions(res.data || []);
    } catch (err) {
      setSubError(err.message || 'Failed to fetch alternative food options');
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleApplySubstitution = (subOption) => {
    if (!selectedFoodForSub || !activePlan) return;

    const { mealIndex, food } = selectedFoodForSub;
    const newMeals = [...activePlan.meals];
    const targetMeal = { ...newMeals[mealIndex] };

    // Create replacement FoodSelectionResult
    const repl = subOption.replacement_food;
    const repNutrition = {
      basis: `${subOption.quantity}${subOption.unit}`,
      calories: Math.round(((repl.nutrition.calories * subOption.quantity) / 100) * 10) / 10,
      protein_g: Math.round(((repl.nutrition.protein_g * subOption.quantity) / 100) * 10) / 10,
      carbohydrate_g: Math.round(((repl.nutrition.carbohydrate_g * subOption.quantity) / 100) * 10) / 10,
      fat_g: Math.round(((repl.nutrition.fat_g * subOption.quantity) / 100) * 10) / 10,
      fiber_g: Math.round(((repl.nutrition.fiber_g * subOption.quantity) / 100) * 10) / 10,
    };

    const newFoodItem = {
      food_id: repl.food_id,
      food_name: repl.food_name,
      category: repl.category,
      quantity: subOption.quantity,
      unit: subOption.unit,
      nutrition: repNutrition,
      selection_reason: `Substituted for ${food.food_name}: ${subOption.reason}`,
      ayurvedic_alignment: `${repl.ayurvedic.virya} virya, rasa: ${repl.ayurvedic.rasa.join(', ')}`,
      sources: subOption.evidence_sources || repl.sources || [],
      requires_dietitian_review: subOption.requires_dietitian_review,
      review_notes: subOption.requires_dietitian_review ? 'Dietitian review requested for substitution' : null,
    };

    // Replace item in meal
    targetMeal.foods = targetMeal.foods.map((f) => (f.food_id === food.food_id ? newFoodItem : f));

    // Recalculate meal totals
    targetMeal.totals = {
      calories: Math.round(targetMeal.foods.reduce((acc, f) => acc + f.nutrition.calories, 0) * 10) / 10,
      protein_g: Math.round(targetMeal.foods.reduce((acc, f) => acc + f.nutrition.protein_g, 0) * 10) / 10,
      carbohydrate_g: Math.round(targetMeal.foods.reduce((acc, f) => acc + f.nutrition.carbohydrate_g, 0) * 10) / 10,
      fat_g: Math.round(targetMeal.foods.reduce((acc, f) => acc + f.nutrition.fat_g, 0) * 10) / 10,
      fiber_g: Math.round(targetMeal.foods.reduce((acc, f) => acc + f.nutrition.fiber_g, 0) * 10) / 10,
    };
    newMeals[mealIndex] = targetMeal;

    // Recalculate daily totals
    const newDaily = {
      calories: Math.round(newMeals.reduce((acc, m) => acc + (m.totals.calories || 0), 0) * 10) / 10,
      protein_g: Math.round(newMeals.reduce((acc, m) => acc + (m.totals.protein_g || 0), 0) * 10) / 10,
      carbohydrate_g: Math.round(newMeals.reduce((acc, m) => acc + (m.totals.carbohydrate_g || 0), 0) * 10) / 10,
      fat_g: Math.round(newMeals.reduce((acc, m) => acc + (m.totals.fat_g || 0), 0) * 10) / 10,
      fiber_g: Math.round(newMeals.reduce((acc, m) => acc + (m.totals.fiber_g || 0), 0) * 10) / 10,
    };

    // Update target comparison
    const tgt = activePlan.target_comparison?.targets || {};
    const newDiff = {
      calories: Math.round((newDaily.calories - (tgt.calories || 0)) * 10) / 10,
      protein: Math.round((newDaily.protein_g - (tgt.protein || 0)) * 10) / 10,
      carbohydrate: Math.round((newDaily.carbohydrate_g - (tgt.carbohydrate || 0)) * 10) / 10,
      fat: Math.round((newDaily.fat_g - (tgt.fat || 0)) * 10) / 10,
    };

    setActivePlan({
      ...activePlan,
      meals: newMeals,
      daily_totals: newDaily,
      target_comparison: {
        ...activePlan.target_comparison,
        actual: newDaily,
        difference: newDiff,
      },
    });

    setSubModalOpen(false);
    setSelectedFoodForSub(null);
  };

  const formatMealTitle = (type) => {
    switch (type) {
      case 'breakfast':
        return 'Morning Breakfast (Pratarasha)';
      case 'mid_morning':
        return 'Mid-Morning Snack';
      case 'lunch':
        return 'Mid-Day Lunch (Madhyahnika Ahara)';
      case 'evening_snack':
        return 'Evening Refreshment (Sayam Ahara)';
      case 'dinner':
        return 'Evening Dinner (Ratri Ahara)';
      default:
        return type.replace('_', ' ').toUpperCase();
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'cereal_grain':
        return '#fef3c7'; // amber
      case 'pulse_legume':
        return '#e0f2fe'; // blue
      case 'vegetable':
        return '#dcfce7'; // green
      case 'fruit':
        return '#fce7f3'; // pink
      case 'dairy':
        return '#ede9fe'; // purple
      case 'nut_seed':
        return '#ffedd5'; // orange
      case 'spice_herb':
        return '#f1f5f9'; // slate
      default:
        return '#f3f4f6';
    }
  };

  return (
    <div className="meal-plan-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8faf9',
          padding: '1.2rem 1.5rem',
          borderRadius: '8px',
          border: '1px solid #e2ece7',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#1b4332', fontSize: '1.25rem' }}>
              Phase 5 Deterministic Meal Plan
            </h3>
            {activePlan && (
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: activePlan.requires_dietitian_review ? '#fef3c7' : '#dcfce7',
                  color: activePlan.requires_dietitian_review ? '#92400e' : '#166534',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <DashboardIcon name={activePlan.requires_dietitian_review ? 'shield-alert' : 'check'} size={12} />
                <span>{activePlan.requires_dietitian_review ? 'Needs Dietitian Review' : 'Clinically Validated'}</span>
              </span>
            )}
          </div>
          <p style={{ margin: '0.3rem 0 0', color: '#4a5d55', fontSize: '0.88rem' }}>
            Portions calculated deterministically from ICMR-NIN IFCT tables and Ayurvedic Dravyaguna principles.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={onGeneratePlan}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <DashboardIcon name="sparkles" size={15} />
            <span>{loading ? 'Generating Plan...' : 'Generate Meal Plan'}</span>
          </button>

          {activePlan && onSavePlan && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSavePlan({ ...activePlan, dietitian_notes: dietitianNotes })}
              disabled={savingPlan}
              style={{ borderColor: '#2d6a4f', color: '#1b4332', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <DashboardIcon name="check" size={14} />
              <span>{savingPlan ? 'Saving...' : 'Save Meal Plan'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '0.9rem',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {!activePlan && !loading && (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '8px',
            border: '2px dashed #cbd5e1',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
            <DashboardIcon name="utensils" size={42} />
          </div>
          <h4 style={{ margin: 0, color: '#334155' }}>No Meal Plan Generated Yet</h4>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '500px', margin: '0.5rem auto 1.5rem' }}>
            Click "Generate Meal Plan" to construct an Ayurvedic-aligned, macro-balanced daily meal plan grounded in Phase 3 targets and knowledge base evidence.
          </p>
          <button type="button" className="btn-primary" onClick={onGeneratePlan} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <DashboardIcon name="sparkles" size={16} />
            <span>Generate Meal Plan Now</span>
          </button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#2d6a4f' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: 'var(--color-primary)', animation: 'spin 1.5s linear infinite' }}>
            <DashboardIcon name="refresh-cw" size={32} />
          </div>
          <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
            Evaluating eligible foods, balancing macronutrients & optimizing portions...
          </p>
        </div>
      )}

      {activePlan && !loading && (
        <>
          {/* Dietitian Clinical Review Banner if flagged */}
          {activePlan.requires_dietitian_review && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                color: '#92400e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <DashboardIcon name="shield-alert" size={16} />
                <span>Clinical & Ayurvedic Verification Required</span>
              </div>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.88rem' }}>
                {(activePlan.review_reasons || []).map((reason, idx) => (
                  <li key={idx} style={{ marginTop: '0.2rem' }}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Daily Nutrition Targets vs Actuals Comparison Card */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2ece7',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid #edf2f0',
                paddingBottom: '0.75rem',
              }}
            >
              <div>
                <h4 style={{ margin: 0, color: '#1b4332', fontSize: '1.05rem' }}>
                  Daily Macronutrient Targets vs Actual Portions
                </h4>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Target tolerances: Energy ±7.5% | Protein, Carbs, Fat ±10%
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '12px',
                  background: activePlan.target_comparison?.within_target ? '#dcfce7' : '#fef3c7',
                  color: activePlan.target_comparison?.within_target ? '#166534' : '#92400e',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <DashboardIcon name={activePlan.target_comparison?.within_target ? 'check' : 'shield-alert'} size={13} />
                <span>{activePlan.target_comparison?.within_target ? 'Targets Achieved' : 'Minor Variance'}</span>
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
              }}
            >
              {[
                { label: 'Energy (Calories)', key: 'calories', unit: 'kcal', target: activePlan.target_comparison?.targets?.calories, actual: activePlan.daily_totals?.calories },
                { label: 'Protein', key: 'protein', unit: 'g', target: activePlan.target_comparison?.targets?.protein, actual: activePlan.daily_totals?.protein_g },
                { label: 'Carbohydrates', key: 'carbohydrate', unit: 'g', target: activePlan.target_comparison?.targets?.carbohydrate, actual: activePlan.daily_totals?.carbohydrate_g },
                { label: 'Total Fats', key: 'fat', unit: 'g', target: activePlan.target_comparison?.targets?.fat, actual: activePlan.daily_totals?.fat_g },
                { label: 'Dietary Fiber', key: 'fiber', unit: 'g', target: activePlan.nutrition_targets?.other_targets?.fiber_g_day || 25, actual: activePlan.daily_totals?.fiber_g },
              ].map((item) => {
                const diff = Math.round(((item.actual || 0) - (item.target || 0)) * 10) / 10;
                return (
                  <div
                    key={item.key}
                    style={{
                      background: '#f8faf9',
                      border: '1px solid #e2ece7',
                      borderRadius: '6px',
                      padding: '0.75rem',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      {item.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1b4332' }}>
                        {item.actual || 0}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#4a5d55' }}>
                        / {item.target || 0} {item.unit}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        marginTop: '0.2rem',
                        fontWeight: 600,
                        color: Math.abs(diff) <= 20 ? '#166534' : diff > 0 ? '#b45309' : '#0369a1',
                      }}
                    >
                      {diff > 0 ? `+${diff}` : diff} {item.unit} ({item.target ? Math.round(((item.actual || 0) / item.target) * 100) : 100}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Constructed Meals Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {activePlan.meals.map((meal, mealIdx) => (
              <div
                key={meal.meal_id || mealIdx}
                style={{
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2ece7',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Meal Header */}
                <div
                  style={{
                    background: '#f4f8f6',
                    padding: '0.85rem 1.25rem',
                    borderBottom: '1px solid #e2ece7',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h4 style={{ margin: 0, color: '#1b4332', fontSize: '1.05rem', fontWeight: 700 }}>
                      {formatMealTitle(meal.meal_type)}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.82rem', color: '#4a5d55', fontWeight: 600 }}>
                    <span>Calories: <strong>{meal.totals?.calories || 0} kcal</strong> (Target: {meal.target_calories} kcal)</span>
                    <span>•</span>
                    <span>P: {meal.totals?.protein_g || 0}g</span>
                    <span>•</span>
                    <span>C: {meal.totals?.carbohydrate_g || 0}g</span>
                    <span>•</span>
                    <span>F: {meal.totals?.fat_g || 0}g</span>
                    <span>•</span>
                    <span>Fiber: {meal.totals?.fiber_g || 0}g</span>
                  </div>
                </div>

                {/* Foods Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#fafcfb', borderBottom: '1px solid #edf2f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '0.65rem 1rem', width: '30%' }}>Food Item & Category</th>
                        <th style={{ padding: '0.65rem 0.8rem', width: '15%' }}>Portion</th>
                        <th style={{ padding: '0.65rem 0.8rem', width: '25%' }}>Nutrition (Portion)</th>
                        <th style={{ padding: '0.65rem 0.8rem', width: '15%' }}>Why Selected?</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'right', width: '15%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meal.foods.map((food, foodIdx) => {
                        const foodKey = `${meal.meal_id}_${food.food_id}_${foodIdx}`;
                        const isExpanded = expandedReasons[foodKey];

                        return (
                          <React.Fragment key={foodKey}>
                            <tr
                              style={{
                                borderBottom: '1px solid #f1f5f3',
                                background: foodIdx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                              }}
                            >
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {food.food_name}
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      background: getCategoryColor(food.category),
                                      color: '#334155',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {food.category.replace('_', ' ')}
                                  </span>
                                  {food.requires_dietitian_review && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Review Required
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td style={{ padding: '0.75rem 0.8rem', fontWeight: 600, color: '#0f766e' }}>
                                {food.quantity} {food.unit}
                              </td>

                              <td style={{ padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: '#475569' }}>
                                <div><strong>{food.nutrition.calories}</strong> kcal | <strong>{food.nutrition.protein_g}g</strong> protein</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  C: {food.nutrition.carbohydrate_g}g | F: {food.nutrition.fat_g}g | Fib: {food.nutrition.fiber_g}g
                                </div>
                              </td>

                              <td style={{ padding: '0.75rem 0.8rem' }}>
                                <button
                                  type="button"
                                  onClick={() => toggleReason(foodKey)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#2d6a4f',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  {isExpanded ? 'Hide Reason ▲' : 'View Reason ▼'}
                                </button>
                              </td>

                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubstitution(mealIdx, food, meal.meal_type)}
                                  style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    color: '#166534',
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '5px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Find eligible substitutes for this food"
                                >
                                  <DashboardIcon name="refresh-cw" size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                  <span>Substitute</span>
                                </button>
                              </td>
                            </tr>

                            {/* Expandable Explanation Details */}
                            {isExpanded && (
                              <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e2ece7' }}>
                                <td colSpan={5} style={{ padding: '0.85rem 1.25rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.84rem' }}>
                                    <div>
                                      <strong style={{ color: '#1b4332' }}>Clinical Justification: </strong>
                                      <span style={{ color: '#334155' }}>{food.selection_reason}</span>
                                    </div>
                                    <div>
                                      <strong style={{ color: '#854d0e' }}>Ayurvedic Alignment: </strong>
                                      <span style={{ color: '#334155' }}>{food.ayurvedic_alignment}</span>
                                    </div>
                                    {food.sources && food.sources.length > 0 && (
                                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        <strong>Knowledge Base Source: </strong>
                                        {food.sources.map((s, i) => (
                                          <span key={i}>
                                            {s.document} {s.page ? `(p. ${s.page})` : ''}
                                            {i < food.sources.length - 1 ? '; ' : ''}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Dietitian Notes Section */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2ece7',
              padding: '1.25rem',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem', color: '#1b4332', fontSize: '1rem' }}>
              Dietitian Clinical Notes & Instructions
            </h4>
            <textarea
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
              }}
              placeholder="Add clinical observations, timing instructions, or Ayurvedic cooking tips for the patient..."
              value={dietitianNotes}
              onChange={(e) => setDietitianNotes(e.target.value)}
            />
          </div>

          {/* Grounded Knowledge Base Evidence Section */}
          {activePlan.evidence && activePlan.evidence.length > 0 && (
            <div
              style={{
                background: '#f8faf9',
                borderRadius: '8px',
                border: '1px solid #e2ece7',
                padding: '1.25rem',
              }}
            >
              <h4 style={{ margin: '0 0 0.6rem', color: '#1b4332', fontSize: '1rem' }}>
                Phase 4 Knowledge Base Citations & Provenance
              </h4>
              <p style={{ margin: '0 0 0.8rem', fontSize: '0.82rem', color: '#64748b' }}>
                The following classical texts and ICMR-NIN nutritional compendiums ground the food selections and Dravyaguna attributes in this plan:
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.6rem',
                }}
              >
                {activePlan.evidence.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2ece7',
                      borderRadius: '6px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1b4332' }}>{src.document}</div>
                    {src.page && <div style={{ color: '#0f766e', fontSize: '0.75rem' }}>Page: {src.page}</div>}
                    {src.notes && <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>{src.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Substitution Modal */}
      {subModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              border: '1px solid #cbd5e1',
            }}
          >
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: '#1b4332', fontSize: '1.15rem' }}>
                  Food Alternatives & Substitutions
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Replacing <strong>{selectedFoodForSub?.food.food_name}</strong> ({selectedFoodForSub?.food.quantity}{selectedFoodForSub?.food.unit})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {loadingSubs && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#2d6a4f' }}>
                  Searching eligible, allergen-safe substitutes...
                </div>
              )}

              {subError && (
                <div style={{ padding: '0.8rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
                  {subError}
                </div>
              )}

              {!loadingSubs && substitutions.length === 0 && !subError && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No alternative foods found meeting the patient's dietary safety restrictions.
                </div>
              )}

              {!loadingSubs && substitutions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {substitutions.map((sub, i) => {
                    const rf = sub.replacement_food;
                    const deltaCal = sub.nutritional_delta?.calories || 0;
                    const deltaProt = sub.nutritional_delta?.protein_g || 0;

                    return (
                      <div
                        key={i}
                        style={{
                          border: '1px solid #e2ece7',
                          borderRadius: '8px',
                          padding: '1rem',
                          background: '#fcfdfd',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#1b4332', fontSize: '0.98rem' }}>
                              {rf.food_name} {rf.local_name ? `(${rf.local_name})` : ''}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#0f766e', fontWeight: 600 }}>
                              Recommended portion: {sub.quantity} {sub.unit}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleApplySubstitution(sub)}
                            style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <DashboardIcon name="check" size={12} />
                            <span>Apply Substitute</span>
                          </button>
                        </div>

                        {/* Nutritional delta chips */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: Math.abs(deltaCal) <= 20 ? '#dcfce7' : '#fee2e2',
                              color: Math.abs(deltaCal) <= 20 ? '#166534' : '#991b1b',
                              fontWeight: 600,
                            }}
                          >
                            {deltaCal >= 0 ? `+${deltaCal}` : deltaCal} kcal
                          </span>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontWeight: 600,
                            }}
                          >
                            {deltaProt >= 0 ? `+${deltaProt}` : deltaProt}g Protein
                          </span>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            Virya: {rf.ayurvedic?.virya}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#4a5d55', lineHeight: '1.4' }}>
                          {sub.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid #e2e8f0',
                textAlign: 'right',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSubModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
