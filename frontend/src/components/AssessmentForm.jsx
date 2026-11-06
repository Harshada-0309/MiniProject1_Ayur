import React, { useState, useEffect } from 'react';
import NutritionTargetsView from './NutritionTargetsView';
import MealPlanView from './MealPlanView';
import DietPlanView from './DietPlanView';
import DashboardIcon from './ui/DashboardIcons';
import { api } from '../services/api';
import {
  validateHumanName,
  preventNumberInput,
  validateOccupation,
  validateAge,
  validateDate,
  validateMeasurement,
  validatePhone,
  validateDescriptiveText,
  validateNutritionTargetFreshness,
} from '../utils/nameValidation';

const SECTIONS = [
  { id: 'sec-basic', label: '1. Basic Details', num: '1', iconName: 'user-round', desc: 'Demographics & consultation date' },
  { id: 'sec-body', label: '2. Body Measurements', num: '2', iconName: 'activity', desc: 'Anthropometrics, BMI & waist' },
  { id: 'sec-goal', label: '3. Diet Goal', num: '3', iconName: 'target', desc: 'Primary therapeutic objective' },
  { id: 'sec-lifestyle', label: '4. Lifestyle', num: '4', iconName: 'sun', desc: 'Activity, sleep & bowel habits' },
  { id: 'sec-diet', label: '5. Dietary Profile', num: '5', iconName: 'utensils', desc: 'Diet category, schedule & fluids' },
  { id: 'sec-safety', label: '6. Safety Restrictions', num: '6', iconName: 'shield-alert', desc: 'Food allergies & contraindications' },
  { id: 'sec-medical', label: '7. Medical Info', num: '7', iconName: 'stethoscope', desc: 'Conditions, medications & surgeries' },
  { id: 'sec-ayurveda', label: '8. Ayurvedic Info', num: '8', iconName: 'sprout', desc: 'Prakriti, Agni, Koshtha & Ama' },
  { id: 'sec-lab', label: '9. Clinical / Lab (Optional)', num: '9', iconName: 'flask', desc: 'Pathology & biomarker values' },
  { id: 'sec-nutrition', label: '10. Nutrition Targets (Engine)', num: '10', iconName: 'cpu', desc: 'Calculated calories & macros' },
  { id: 'sec-mealplan', label: '11. Food & Meal Plan', num: '11', iconName: 'utensils', desc: 'Daily Ayurvedic meal items' },
  { id: 'sec-dietplan', label: '12. 7-Day Diet Plan (Gemini)', num: '12', iconName: 'calendar-days', desc: 'Verified 7-day personalized regimen' },
];

function checkSectionFilled(sectionId, formData, labRecords, targets, mealPlan, dietPlan) {
  if (!formData) return false;
  switch (sectionId) {
    case 'sec-basic':
      return Boolean(formData.assessment_date);
    case 'sec-body':
      return Boolean(formData.height && formData.weight);
    case 'sec-goal':
      return Boolean(formData.diet_goal);
    case 'sec-lifestyle':
      return Boolean(formData.sleep_duration_hours || formData.physical_activity_level || formData.bowel_movements);
    case 'sec-diet':
      return Boolean(formData.diet_category);
    case 'sec-safety':
      return Boolean((formData.allergies && formData.allergies.length > 0) || formData.contraindications);
    case 'sec-medical':
      return Boolean((formData.conditions && formData.conditions.length > 0) || formData.medications);
    case 'sec-ayurveda':
      return Boolean(formData.prakriti && formData.prakriti !== 'Unknown / Not assessed');
    case 'sec-lab':
      return Boolean(labRecords && labRecords.length > 0);
    case 'sec-nutrition':
      return Boolean(targets);
    case 'sec-mealplan':
      return Boolean(mealPlan);
    case 'sec-dietplan':
      return Boolean(dietPlan);
    default:
      return false;
  }
}

const PRAKRITI_OPTIONS = [
  { value: 'Vata', label: 'Vata', type: 'vata' },
  { value: 'Pitta', label: 'Pitta', type: 'pitta' },
  { value: 'Kapha', label: 'Kapha', type: 'kapha' },
  { value: 'Vata-Pitta', label: 'Vata-Pitta', type: 'dual' },
  { value: 'Pitta-Kapha', label: 'Pitta-Kapha', type: 'dual' },
  { value: 'Vata-Kapha', label: 'Vata-Kapha', type: 'dual' },
  { value: 'Tridosha', label: 'Tridosha (Sama)', type: 'tri' },
  { value: 'Unknown / Not assessed', label: 'Unknown / Not Assessed', type: 'neutral' },
];

const DIET_GOALS = [
  { id: 'weight_loss', title: 'Weight Loss', desc: 'Caloric moderation & metabolic stimulation' },
  { id: 'weight_maintenance', title: 'Weight Maintenance', desc: 'Sustained energy and doshic equilibrium' },
  { id: 'weight_gain', title: 'Weight Gain', desc: 'Brimhana nourishing therapies & tissue build' },
  { id: 'general_healthy_diet', title: 'General Healthy Diet', desc: 'Holistic wellness & seasonal alignment' },
  { id: 'condition_specific_nutrition', title: 'Condition-Specific Nutrition', desc: 'Targeted clinical dietary therapy' },
];

const DIET_CATEGORIES = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'eggetarian', label: 'Eggetarian' },
  { id: 'non_vegetarian', label: 'Non-Vegetarian' },
  { id: 'other', label: 'Other' },
];

const APPETITE_OPTIONS = [
  { id: 'Samagni (Balanced)', title: 'Samagni (Balanced)', desc: 'Even, predictable hunger & effortless digestion' },
  { id: 'Tikshnagni (Sharp/High)', title: 'Tikshnagni (Sharp / High)', desc: 'Intense frequent hunger, prone to acid/heat' },
  { id: 'Mandagni (Low)', title: 'Mandagni (Low / Sluggish)', desc: 'Poor hunger, heavy feeling after food' },
  { id: 'Vishamagni (Irregular)', title: 'Vishamagni (Irregular)', desc: 'Fluctuating hunger, erratic digestion' },
];

const SEASONS = [
  'Shishira (Late Winter)',
  'Vasanta (Spring)',
  'Grishma (Summer)',
  'Varsha (Monsoon)',
  'Sharad (Autumn)',
  'Hemanta (Early Winter)',
];

export default function AssessmentForm({
  patient,
  existingAssessment,
  onSaveAssessment,
  onOpenLabModal,
  onEditLabRecord,
  onDeleteLabRecord,
  onDeleteLabAttachment,
  labRecords = [],
  savedMealPlan = null,
  savedDietPlan = null,
  onMealPlanSaved,
  onDietPlanSaved,
  onSwitchPatient,
  showPatientSidebar = false,
  onOpenNewPatientModal,
  onUpdatePatientPhoto,
  onRequestDeletePatient,
}) {
  const [activeTab, setActiveTab] = useState('sec-basic');
  const [viewMode, setViewMode] = useState('stepper'); // 'stepper' or 'all'
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [nutritionTargets, setNutritionTargets] = useState(
    savedMealPlan?.nutrition_targets ||
    savedDietPlan?.validation_results?.nutrition_targets ||
    savedDietPlan?.nutrition_targets ||
    null
  );
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [targetError, setTargetError] = useState(null);

  // Snapshot of inputs used to calculate targets (for stale detection)
  const [targetInputsSnapshot, setTargetInputsSnapshot] = useState(null);

  // Snapshot of inputs used to generate meal/diet plans (for stale detection)
  const [planInputsSnapshot, setPlanInputsSnapshot] = useState(null);

  // Phase 5 Meal Plan State
  const [mealPlan, setMealPlan] = useState(savedMealPlan || null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Phase 6 Gemini 7-Day Diet Plan State
  const [dietPlan, setDietPlan] = useState(savedDietPlan || null);
  const [loadingDietPlan, setLoadingDietPlan] = useState(false);
  const [dietPlanError, setDietPlanError] = useState(null);

  // Synchronize meal plan when saved plan prop or patient changes
  useEffect(() => {
    setMealPlan(savedMealPlan || null);
    setPlanError(null);
  }, [savedMealPlan, patient?.id]);

  // Synchronize 7-day diet plan when saved plan prop or patient changes
  useEffect(() => {
    setDietPlan(savedDietPlan || null);
    setDietPlanError(null);
  }, [savedDietPlan, patient?.id]);

  // Reset or rehydrate nutrition targets when active patient or saved plans change
  useEffect(() => {
    let targets =
      savedMealPlan?.nutrition_targets ||
      savedDietPlan?.validation_results?.nutrition_targets ||
      savedDietPlan?.nutrition_targets ||
      null;

    // If no targets in saved plans, check active session storage for this patient
    if (!targets && patient?.id) {
      try {
        const cached = sessionStorage.getItem(`ayurdiet_targets_patient_${patient.id}`);
        if (cached) {
          targets = JSON.parse(cached);
        }
      } catch {
        // ignore
      }
    }

    if (
      targets &&
      (!targets.patient_id ||
        String(targets.patient_id) === String(patient?.id) ||
        String(targets.patient_id) === String(patient?.patient_code) ||
        String(targets.patient_id).toUpperCase() === 'TEMP')
    ) {
      setNutritionTargets(targets);

      let snap = null;
      if (patient?.id) {
        try {
          const cachedSnap = sessionStorage.getItem(`ayurdiet_snapshot_patient_${patient.id}`);
          if (cachedSnap) snap = JSON.parse(cachedSnap);
        } catch {
          // ignore
        }
      }

      if (!snap && targets.anthropometrics) {
        snap = {
          height: targets.anthropometrics.height_cm,
          weight: targets.anthropometrics.weight_kg,
          age: targets.energy?.age ?? (patient?.age ?? ''),
          sex: targets.energy?.sex ?? (patient?.sex || 'male'),
          activity_level: targets.energy?.activity_level || existingAssessment?.activity_level || 'sedentary',
          diet_goal: targets.energy?.goal || existingAssessment?.diet_goal || 'general_healthy_diet',
        };
      }
      if (snap) {
        setTargetInputsSnapshot(snap);
      }
    } else if (!targets) {
      // Preserve existing in-memory targets if they belong to this active patient
      setNutritionTargets((prev) => {
        if (
          prev &&
          patient?.id &&
          (String(prev.patient_id) === String(patient.id) ||
            String(prev.patient_id) === String(patient.patient_code) ||
            String(prev.patient_id).toUpperCase() === 'TEMP')
        ) {
          return prev;
        }
        return null;
      });
    }
    setTargetError(null);
  }, [patient?.id, savedMealPlan?.nutrition_targets, savedDietPlan?.id, savedDietPlan?.validation_results?.nutrition_targets]);


  // Form State
  const [formData, setFormData] = useState({
    // Section 1: Basic
    name: patient?.name || '',
    age: patient?.age ?? '',
    sex: patient?.sex || 'male',
    occupation: patient?.occupation || '',
    assessment_date: new Date().toISOString().split('T')[0],
    dietitian_id: 'dietitian-primary',

    // Section 2: Measurements
    height: '',
    weight: '',
    waist_circumference: '',
    weight_trend: 'stable',

    // Section 3: Goal
    diet_goal: 'general_healthy_diet',
    target_weight: '',
    goal_notes: '',

    // Section 4: Lifestyle
    activity_level: 'sedentary',
    exercise_type: '',
    exercise_frequency: '',
    exercise_duration: '',
    sleep_duration: '7',
    sleep_quality: 'good',
    water_intake: '2.5',

    // Section 5: Dietary Profile
    diet_category: 'vegetarian',
    meal_frequency: 3,
    meal_timings: '',
    food_preferences: '',
    foods_disliked: '',

    // Section 6: Safety Restrictions
    food_allergies: '',
    food_intolerances: '',
    dietary_restrictions: '',

    // Section 7: Medical Info
    existing_conditions: '',
    medical_history: '',
    symptoms: '',
    supplements: '',
    medications: [],

    // Section 8: Ayurvedic Info
    prakriti: 'Unknown / Not assessed',
    vikriti: '',
    appetite: 'Samagni (Balanced)',
    digestion: 'Normal',
    bowel_habits: 'Regular',
    meal_regularity: 'regular',
    season_ritu: 'Vasanta (Spring)',
    dietitian_observations: '',
  });

  // Populate when patient or existingAssessment changes
  useEffect(() => {
    setNameError(null);
    if (existingAssessment) {
      setFormData({
        name: patient?.name || '',
        age: patient?.age ?? '',
        sex: patient?.sex || 'male',
        occupation: patient?.occupation || '',
        assessment_date: existingAssessment.assessment_date
          ? existingAssessment.assessment_date.split('T')[0]
          : new Date().toISOString().split('T')[0],
        dietitian_id: existingAssessment.dietitian_id || 'dietitian-primary',
        height: existingAssessment.height ?? '',
        weight: existingAssessment.weight ?? '',
        waist_circumference: existingAssessment.waist_circumference ?? '',
        weight_trend: existingAssessment.weight_trend || 'stable',
        diet_goal: existingAssessment.diet_goal || 'general_healthy_diet',
        target_weight: existingAssessment.target_weight ?? '',
        goal_notes: existingAssessment.goal_notes || '',
        activity_level: existingAssessment.activity_level || 'sedentary',
        exercise_type: existingAssessment.exercise_type || '',
        exercise_frequency: existingAssessment.exercise_frequency || '',
        exercise_duration: existingAssessment.exercise_duration || '',
        sleep_duration: existingAssessment.sleep_duration ?? '7',
        sleep_quality: existingAssessment.sleep_quality || 'good',
        water_intake: existingAssessment.water_intake ?? '2.5',
        diet_category: existingAssessment.diet_category || 'vegetarian',
        meal_frequency: existingAssessment.meal_frequency || 3,
        meal_timings: Array.isArray(existingAssessment.meal_timings)
          ? existingAssessment.meal_timings.join(', ')
          : existingAssessment.meal_timings || '',
        food_preferences: existingAssessment.food_preferences || '',
        foods_disliked: existingAssessment.foods_disliked || '',
        food_allergies: Array.isArray(existingAssessment.food_allergies)
          ? existingAssessment.food_allergies.join(', ')
          : existingAssessment.food_allergies || '',
        food_intolerances: Array.isArray(existingAssessment.food_intolerances)
          ? existingAssessment.food_intolerances.join(', ')
          : existingAssessment.food_intolerances || '',
        dietary_restrictions: Array.isArray(existingAssessment.dietary_restrictions)
          ? existingAssessment.dietary_restrictions.join(', ')
          : existingAssessment.dietary_restrictions || '',
        existing_conditions: Array.isArray(existingAssessment.existing_conditions)
          ? existingAssessment.existing_conditions.join(', ')
          : existingAssessment.existing_conditions || '',
        medical_history: existingAssessment.medical_history || '',
        symptoms: Array.isArray(existingAssessment.symptoms)
          ? existingAssessment.symptoms.map((s) => (typeof s === 'object' ? `${s.symptom} (${s.severity || ''})` : s)).join(', ')
          : existingAssessment.symptoms || '',
        supplements: existingAssessment.supplements || '',
        medications: existingAssessment.medications || [],
        prakriti: existingAssessment.prakriti || 'Unknown / Not assessed',
        vikriti: existingAssessment.vikriti || '',
        appetite: existingAssessment.appetite || 'Samagni (Balanced)',
        digestion: existingAssessment.digestion || 'Normal',
        bowel_habits: existingAssessment.bowel_habits || 'Regular',
        meal_regularity: existingAssessment.meal_regularity || 'regular',
        season_ritu: existingAssessment.season_ritu || 'Vasanta (Spring)',
        dietitian_observations: existingAssessment.dietitian_observations || '',
      });
    } else {
      // Reset to defaults for a new assessment
      setFormData({
        name: patient?.name || '',
        age: patient?.age ?? '',
        sex: patient?.sex || 'male',
        occupation: patient?.occupation || '',
        assessment_date: new Date().toISOString().split('T')[0],
        dietitian_id: 'dietitian-primary',
        height: '',
        weight: '',
        waist_circumference: '',
        weight_trend: 'stable',
        diet_goal: 'general_healthy_diet',
        target_weight: '',
        goal_notes: '',
        activity_level: 'sedentary',
        exercise_type: '',
        exercise_frequency: '',
        exercise_duration: '',
        sleep_duration: '7',
        sleep_quality: 'good',
        water_intake: '2.5',
        diet_category: 'vegetarian',
        meal_frequency: 3,
        meal_timings: '',
        food_preferences: '',
        foods_disliked: '',
        food_allergies: '',
        food_intolerances: '',
        dietary_restrictions: '',
        existing_conditions: '',
        medical_history: '',
        symptoms: '',
        supplements: '',
        medications: [],
        prakriti: 'Unknown / Not assessed',
        vikriti: '',
        appetite: 'Samagni (Balanced)',
        digestion: 'Normal',
        bowel_habits: 'Regular',
        meal_regularity: 'regular',
        season_ritu: 'Vasanta (Spring)',
        dietitian_observations: '',
      });
    }
  }, [patient, existingAssessment]);

  // Synchronize snapshots for stale detection when patient, existingAssessment, or saved plans change
  useEffect(() => {
    // Only synchronize snapshot from savedMealPlan/assessment if we don't already have an in-memory snapshot for current patient
    setTargetInputsSnapshot((prev) => {
      if (prev && nutritionTargets && (!nutritionTargets.patient_id || String(nutritionTargets.patient_id) === String(patient?.id) || String(nutritionTargets.patient_id) === String(patient?.patient_code))) {
        return prev;
      }
      if (savedMealPlan?.nutrition_targets || savedDietPlan?.validation_results?.nutrition_targets) {
        return {
          height: existingAssessment?.height ?? '',
          weight: existingAssessment?.weight ?? '',
          age: patient?.age ?? '',
          sex: patient?.sex || 'male',
          activity_level: existingAssessment?.activity_level || 'sedentary',
          diet_goal: existingAssessment?.diet_goal || 'general_healthy_diet',
        };
      }
      return prev;
    });

    if (savedMealPlan || savedDietPlan) {
      setPlanInputsSnapshot({
        food_allergies: Array.isArray(existingAssessment?.food_allergies)
          ? existingAssessment.food_allergies.join(', ')
          : existingAssessment?.food_allergies || '',
        food_intolerances: Array.isArray(existingAssessment?.food_intolerances)
          ? existingAssessment.food_intolerances.join(', ')
          : existingAssessment?.food_intolerances || '',
        dietary_restrictions: Array.isArray(existingAssessment?.dietary_restrictions)
          ? existingAssessment.dietary_restrictions.join(', ')
          : existingAssessment?.dietary_restrictions || '',
        diet_category: existingAssessment?.diet_category || 'vegetarian',
        diet_goal: existingAssessment?.diet_goal || 'general_healthy_diet',
      });
    }
  }, [existingAssessment, savedMealPlan, savedDietPlan, patient?.id, patient?.age, patient?.sex]);

  // Stale targets detection: check if measurement/demographic inputs differ from snapshot or targets
  const freshnessCheck = validateNutritionTargetFreshness({
    nutritionTargets,
    currentInputs: formData,
    targetInputsSnapshot,
    patient,
    assessment: existingAssessment,
  });
  const isTargetsStale = Boolean(nutritionTargets && freshnessCheck.isStale);

  // Stale meal plan detection: check if safety restrictions or targets changed
  const isPlanStale = Boolean(
    (mealPlan || dietPlan) &&
    planInputsSnapshot &&
    (
      String(formData.food_allergies || '').trim() !== String(planInputsSnapshot.food_allergies || '').trim() ||
      String(formData.food_intolerances || '').trim() !== String(planInputsSnapshot.food_intolerances || '').trim() ||
      String(formData.dietary_restrictions || '').trim() !== String(planInputsSnapshot.dietary_restrictions || '').trim() ||
      String(formData.diet_category || '') !== String(planInputsSnapshot.diet_category || '') ||
      String(formData.diet_goal || '') !== String(planInputsSnapshot.diet_goal || '') ||
      isTargetsStale
    )
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleNameKeyDown = (e) => {
    if (preventNumberInput(e)) {
      setNameError('Name cannot contain numerical digits.');
    }
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, name: val }));
    const check = validateHumanName(val, false);
    if (!check.isValid) {
      setNameError(check.error);
    } else {
      setNameError(null);
      if (fieldErrors.name) {
        setFieldErrors((prev) => {
          const copy = { ...prev };
          delete copy.name;
          return copy;
        });
      }
    }
  };

  // Medication Rows Handlers
  const handleAddMedication = () => {
    setFormData((prev) => ({
      ...prev,
      medications: [
        ...prev.medications,
        { medication_name: '', dosage: '', frequency: '', purpose: '' },
      ],
    }));
  };

  const handleMedicationChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.medications];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, medications: updated };
    });
  };

  const handleRemoveMedication = (index) => {
    setFormData((prev) => {
      const updated = prev.medications.filter((_, i) => i !== index);
      return { ...prev, medications: updated };
    });
  };

  const handleComputeTargets = async () => {
    setTargetError(null);
    const h = Number(formData.height);
    const w = Number(formData.weight);
    const a = Number(formData.age !== undefined && formData.age !== '' ? formData.age : patient?.age);

    if (!formData.height || isNaN(h) || h < 30 || h > 300) {
      setTargetError({
        message: 'Valid Height (30–300 cm) in Section 2 is required to compute deterministic nutrition targets.',
      });
      setActiveTab('sec-body');
      return;
    }

    if (!formData.weight || isNaN(w) || w < 10 || w > 500) {
      setTargetError({
        message: 'Valid Weight (10–500 kg) in Section 2 is required to compute deterministic nutrition targets.',
      });
      setActiveTab('sec-body');
      return;
    }

    if (isNaN(a) || a < 0 || a > 105) {
      setTargetError({
        message: 'Valid Age (0–105 years) is required to compute deterministic nutrition targets.',
      });
      setActiveTab('sec-basic');
      return;
    }

    try {
      setLoadingTargets(true);
      setActiveTab('sec-nutrition');

      const toArray = (val) => {
        if (Array.isArray(val)) return val;
        if (!val || typeof val !== 'string') return [];
        return val.split(',').map((s) => s.trim()).filter(Boolean);
      };

      const payload = {
        patient_id: patient?.patient_code || String(patient?.id || 'TEMP'),
        assessment_id: existingAssessment?.id || null,
        age: a,
        sex: formData.sex || patient?.sex || 'other',
        height: h,
        weight: w,
        waist_circumference: formData.waist_circumference ? Number(formData.waist_circumference) : null,
        weight_trend: formData.weight_trend || 'stable',
        diet_goal: formData.diet_goal || 'general_healthy_diet',
        target_weight: formData.target_weight ? Number(formData.target_weight) : null,
        goal_notes: formData.goal_notes || '',
        activity_level: formData.activity_level || 'sedentary',
        exercise_type: formData.exercise_type || '',
        exercise_frequency: formData.exercise_frequency || '',
        exercise_duration: formData.exercise_duration || '',
        sleep_duration: formData.sleep_duration ? Number(formData.sleep_duration) : null,
        sleep_quality: formData.sleep_quality || 'good',
        water_intake: formData.water_intake ? Number(formData.water_intake) : null,
        diet_category: formData.diet_category || 'vegetarian',
        meal_frequency: Number(formData.meal_frequency) || 3,
        meal_timings: toArray(formData.meal_timings),
        food_preferences: formData.food_preferences || '',
        foods_disliked: formData.foods_disliked || '',
        food_allergies: toArray(formData.food_allergies),
        food_intolerances: toArray(formData.food_intolerances),
        dietary_restrictions: toArray(formData.dietary_restrictions),
        existing_conditions: toArray(formData.existing_conditions),
        medical_history: formData.medical_history || '',
        symptoms: toArray(formData.symptoms),
        medications: formData.medications || [],
        supplements: formData.supplements || '',
        prakriti: formData.prakriti || 'Unknown / Not assessed',
        vikriti: formData.vikriti || '',
        appetite: formData.appetite || 'Samagni (Balanced)',
        digestion: formData.digestion || 'Normal',
        bowel_habits: formData.bowel_habits || 'Regular',
        meal_regularity: formData.meal_regularity || 'regular',
        season_ritu: formData.season_ritu || 'Vasanta (Spring)',
        dietitian_observations: formData.dietitian_observations || '',
      };

      const res = await api.calculateNutrition(payload);
      setNutritionTargets(res.data);
      // Snapshot inputs after successful calculation
      const newSnapshot = {
        height: formData.height,
        weight: formData.weight,
        age: a,
        sex: formData.sex || patient?.sex,
        activity_level: formData.activity_level || 'sedentary',
        diet_goal: formData.diet_goal || 'general_healthy_diet',
      };
      setTargetInputsSnapshot(newSnapshot);

      if (patient?.id) {
        try {
          sessionStorage.setItem(`ayurdiet_targets_patient_${patient.id}`, JSON.stringify(res.data));
          sessionStorage.setItem(`ayurdiet_snapshot_patient_${patient.id}`, JSON.stringify(newSnapshot));
        } catch {
          // ignore
        }
      }

      // Clear any prior stale/missing targets errors across sections
      setPlanError(null);
      setDietPlanError(null);
    } catch (err) {
      console.error('Error computing nutrition targets:', err);
      setTargetError(err);
    } finally {
      setLoadingTargets(false);
    }
  };

  const handleGenerateMealPlan = async () => {
    setLoadingPlan(true);
    setPlanError(null);
    try {
      const targetsToCheck = nutritionTargets
        ? {
            ...nutritionTargets,
            patient_id: patient?.id || nutritionTargets.patient_id,
            assessment_id: existingAssessment?.id || nutritionTargets.assessment_id || null,
          }
        : null;

      const freshness = validateNutritionTargetFreshness({
        nutritionTargets: targetsToCheck,
        currentInputs: formData,
        targetInputsSnapshot,
        patient,
        assessment: existingAssessment,
      });

      if (!freshness.valid) {
        setPlanError(freshness.error || 'Deterministic nutrition targets are out of date or missing. Please recompute targets in Section 10 before generating a meal plan.');
        setActiveTab('sec-nutrition');
        setLoadingPlan(false);
        return;
      }

      const toArray = (val) =>
        val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

      const payload = {
        patient_id: patient?.id,
        assessment_id: existingAssessment?.id,
        age: formData.age !== '' && formData.age !== undefined ? parseInt(formData.age, 10) : patient?.age,
        sex: formData.sex || patient?.sex,
        height: Number(formData.height) || 165,
        weight: Number(formData.weight) || 65,
        diet_goal: formData.diet_goal,
        activity_level: formData.activity_level || 'sedentary',
        diet_category: formData.diet_category || 'vegetarian',
        meal_frequency: Number(formData.meal_frequency) || 3,
        food_preferences: formData.food_preferences || '',
        foods_disliked: formData.foods_disliked || '',
        food_allergies: toArray(formData.food_allergies),
        food_intolerances: toArray(formData.food_intolerances),
        dietary_restrictions: toArray(formData.dietary_restrictions),
        existing_conditions: toArray(formData.existing_conditions),
        medications: formData.medications || [],
        prakriti: formData.prakriti || 'Unknown / Not assessed',
        vikriti: formData.vikriti || '',
        appetite: formData.appetite || 'Samagni (Balanced)',
        season_ritu: formData.season_ritu || 'Vasanta (Spring)',
      };

      const res = await api.generateMealPlan({
        patient_assessment: payload,
        nutrition_targets: targetsToCheck,
        target_inputs_snapshot: targetInputsSnapshot,
      });

      setMealPlan(res.data);
      // Snapshot inputs after generation
      setPlanInputsSnapshot({
        food_allergies: formData.food_allergies,
        food_intolerances: formData.food_intolerances,
        dietary_restrictions: formData.dietary_restrictions,
        diet_category: formData.diet_category,
        diet_goal: formData.diet_goal,
      });
      setActiveTab('sec-mealplan');
    } catch (err) {
      console.error('Error generating meal plan:', err);
      setPlanError(err.message || 'Failed to generate meal plan');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSaveMealPlan = async (planToSave) => {
    setSavingPlan(true);
    try {
      const res = await api.saveMealPlan({
        ...planToSave,
        patient_id: patient?.id || 1,
        assessment_id: existingAssessment?.id || null,
      });
      const saved = res.data || planToSave;
      setMealPlan(saved);
      if (onMealPlanSaved) onMealPlanSaved(saved);
      alert('Meal plan saved successfully!');
    } catch (err) {
      console.error('Error saving meal plan:', err);
      alert(`Failed to save meal plan: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleGenerateDietPlan = async (dietitianNotes = '') => {
    setLoadingDietPlan(true);
    setDietPlanError(null);
    try {
      const targetsToCheck = nutritionTargets
        ? {
            ...nutritionTargets,
            patient_id: patient?.id || nutritionTargets.patient_id,
            assessment_id: existingAssessment?.id || nutritionTargets.assessment_id || null,
          }
        : null;

      const freshness = validateNutritionTargetFreshness({
        nutritionTargets: targetsToCheck,
        currentInputs: formData,
        targetInputsSnapshot,
        patient,
        assessment: existingAssessment,
      });

      if (!freshness.valid) {
        setDietPlanError(freshness.error || 'Deterministic nutrition targets are out of date or missing. Please recompute targets in Section 10 before generating a 7-day diet plan.');
        setActiveTab('sec-nutrition');
        setLoadingDietPlan(false);
        return;
      }

      const toArray = (val) =>
        val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

      const payload = {
        patient_id: patient?.id || 1,
        assessment_id: existingAssessment?.id || null,
        name: formData.name || patient?.name,
        age: formData.age !== '' && formData.age !== undefined ? parseInt(formData.age, 10) : patient?.age,
        sex: formData.sex || patient?.sex,
        gender: formData.sex || patient?.sex,
        height: Number(formData.height) || 165,
        weight: Number(formData.weight) || 65,
        activity_level: formData.activity_level || 'sedentary',
        diet_goal: formData.diet_goal || 'general_healthy_diet',
        diet_category: formData.diet_category || 'vegetarian',
        prakriti: formData.prakriti || 'Vata-Pitta',
        vikriti: formData.vikriti || '',
        digestive_fire: formData.appetite || 'Samagni (Balanced)',
        allergies: toArray(formData.food_allergies),
        medical_conditions: toArray(formData.existing_conditions),
        risk_category: 'low',
      };

      const res = await api.generate7DayDietPlan({
        patient_assessment: payload,
        nutrition_targets: targetsToCheck,
        target_inputs_snapshot: targetInputsSnapshot,
        clinical_lab_data: labRecords,
        dietitian_notes: dietitianNotes,
        save: true,
      });

      setDietPlan(res.data);
      if (res.data?.nutrition_targets || res.data?.validation_results?.nutrition_targets) {
        const returnedTargets = res.data.nutrition_targets || res.data.validation_results?.nutrition_targets;
        setNutritionTargets(returnedTargets);
        if (patient?.id) {
          try {
            sessionStorage.setItem(`ayurdiet_targets_patient_${patient.id}`, JSON.stringify(returnedTargets));
          } catch {
            // ignore
          }
        }
      }
      setPlanInputsSnapshot({
        food_allergies: formData.food_allergies,
        food_intolerances: formData.food_intolerances,
        dietary_restrictions: formData.dietary_restrictions,
        diet_category: formData.diet_category,
        diet_goal: formData.diet_goal,
      });
      if (onDietPlanSaved) onDietPlanSaved(res.data);
      setActiveTab('sec-dietplan');
    } catch (err) {
      console.error('Error generating 7-day diet plan:', err);
      setDietPlanError(err.message || 'Failed to generate 7-day diet plan');
    } finally {
      setLoadingDietPlan(false);
    }
  };

  const validateAssessmentData = () => {
    const errors = {};
    let firstSec = null;

    // Section 1: Basic Details
    const currentName = formData.name !== undefined ? formData.name : patient?.name;
    const nameCheck = validateHumanName(currentName, true);
    if (!nameCheck.isValid) {
      errors.name = nameCheck.error;
      if (!firstSec) firstSec = 'sec-basic';
    }

    const currentAge = formData.age !== undefined && formData.age !== '' ? formData.age : patient?.age;
    const ageCheck = validateAge(currentAge, false);
    if (!ageCheck.isValid) {
      errors.age = ageCheck.error;
      if (!firstSec) firstSec = 'sec-basic';
    }

    if (formData.assessment_date) {
      const dateCheck = validateDate(formData.assessment_date, 'Assessment date', false);
      if (!dateCheck.isValid) {
        errors.assessment_date = dateCheck.error;
        if (!firstSec) firstSec = 'sec-basic';
      }
    }

    if (formData.occupation) {
      const occCheck = validateOccupation(formData.occupation);
      if (!occCheck.isValid) {
        errors.occupation = occCheck.error;
        if (!firstSec) firstSec = 'sec-basic';
      }
    }

    // Section 2: Measurements
    if (formData.height !== undefined && formData.height !== '') {
      const hCheck = validateMeasurement(formData.height, 'Height', 30.0, 300.0, 'cm');
      if (!hCheck.isValid) {
        errors.height = hCheck.error;
        if (!firstSec) firstSec = 'sec-body';
      }
    }

    if (formData.weight !== undefined && formData.weight !== '') {
      const wCheck = validateMeasurement(formData.weight, 'Weight', 10.0, 500.0, 'kg');
      if (!wCheck.isValid) {
        errors.weight = wCheck.error;
        if (!firstSec) firstSec = 'sec-body';
      }
    }

    if (formData.waist_circumference !== undefined && formData.waist_circumference !== '') {
      const waistCheck = validateMeasurement(formData.waist_circumference, 'Waist circumference', 30.0, 250.0, 'cm');
      if (!waistCheck.isValid) {
        errors.waist_circumference = waistCheck.error;
        if (!firstSec) firstSec = 'sec-body';
      }
    }

    // Section 3: Goal
    if (!formData.diet_goal) {
      errors.diet_goal = 'Please select a Diet Goal in Section 3.';
      if (!firstSec) firstSec = 'sec-goal';
    }

    if (formData.target_weight !== undefined && formData.target_weight !== '') {
      const twCheck = validateMeasurement(formData.target_weight, 'Target weight', 10.0, 500.0, 'kg');
      if (!twCheck.isValid) {
        errors.target_weight = twCheck.error;
        if (!firstSec) firstSec = 'sec-goal';
      }
    }

    if (formData.goal_notes) {
      const gnCheck = validateDescriptiveText(formData.goal_notes, 'Goal notes', false, 1000);
      if (!gnCheck.isValid) {
        errors.goal_notes = gnCheck.error;
        if (!firstSec) firstSec = 'sec-goal';
      }
    }

    // Section 4: Lifestyle
    if (formData.exercise_type) {
      const etCheck = validateDescriptiveText(formData.exercise_type, 'Exercise type', false, 100);
      if (!etCheck.isValid) {
        errors.exercise_type = etCheck.error;
        if (!firstSec) firstSec = 'sec-lifestyle';
      }
    }

    if (formData.exercise_frequency) {
      const efCheck = validateDescriptiveText(formData.exercise_frequency, 'Exercise frequency', false, 60);
      if (!efCheck.isValid) {
        errors.exercise_frequency = efCheck.error;
        if (!firstSec) firstSec = 'sec-lifestyle';
      }
    }

    if (formData.exercise_duration) {
      const edCheck = validateDescriptiveText(formData.exercise_duration, 'Exercise duration', false, 60);
      if (!edCheck.isValid) {
        errors.exercise_duration = edCheck.error;
        if (!firstSec) firstSec = 'sec-lifestyle';
      }
    }

    if (formData.sleep_duration !== undefined && formData.sleep_duration !== '') {
      const sdCheck = validateMeasurement(formData.sleep_duration, 'Sleep duration', 0.0, 24.0, 'hours');
      if (!sdCheck.isValid) {
        errors.sleep_duration = sdCheck.error;
        if (!firstSec) firstSec = 'sec-lifestyle';
      }
    }

    if (formData.water_intake !== undefined && formData.water_intake !== '') {
      const wiCheck = validateMeasurement(formData.water_intake, 'Water intake', 0.0, 20.0, 'litres');
      if (!wiCheck.isValid) {
        errors.water_intake = wiCheck.error;
        if (!firstSec) firstSec = 'sec-lifestyle';
      }
    }

    // Section 5: Dietary Profile
    if (!formData.diet_category) {
      errors.diet_category = 'Please select a Dietary Profile category in Section 5.';
      if (!firstSec) firstSec = 'sec-diet';
    }

    if (formData.meal_frequency !== undefined && formData.meal_frequency !== '') {
      const mfRaw = String(formData.meal_frequency).trim();
      if (!/^\d+$/.test(mfRaw)) {
        errors.meal_frequency = 'Meal frequency must be an integer between 1 and 8 meals/day.';
        if (!firstSec) firstSec = 'sec-diet';
      } else {
        const mf = Number(mfRaw);
        if (!Number.isInteger(mf) || isNaN(mf) || mf < 1 || mf > 8) {
          errors.meal_frequency = 'Meal frequency must be an integer between 1 and 8 meals/day.';
          if (!firstSec) firstSec = 'sec-diet';
        }
      }
    }

    if (formData.meal_timings) {
      const mtCheck = validateDescriptiveText(formData.meal_timings, 'Meal timings', false, 250);
      if (!mtCheck.isValid) {
        errors.meal_timings = mtCheck.error;
        if (!firstSec) firstSec = 'sec-diet';
      }
    }

    if (formData.food_preferences) {
      const fpCheck = validateDescriptiveText(formData.food_preferences, 'Food preferences', false, 1000);
      if (!fpCheck.isValid) {
        errors.food_preferences = fpCheck.error;
        if (!firstSec) firstSec = 'sec-diet';
      }
    }

    if (formData.foods_disliked) {
      const fdCheck = validateDescriptiveText(formData.foods_disliked, 'Foods disliked', false, 1000);
      if (!fdCheck.isValid) {
        errors.foods_disliked = fdCheck.error;
        if (!firstSec) firstSec = 'sec-diet';
      }
    }

    // Section 6: Safety Restrictions
    const validateCommaDelimited = (val, fieldKey, fieldName, sectionId) => {
      if (!val) return;
      const items = String(val).split(',').map((s) => s.trim()).filter(Boolean);
      for (const item of items) {
        const check = validateDescriptiveText(item, fieldName, false, 250);
        if (!check.isValid) {
          errors[fieldKey] = check.error;
          if (!firstSec) firstSec = sectionId;
          break;
        }
      }
    };

    validateCommaDelimited(formData.food_allergies, 'food_allergies', 'Food allergies', 'sec-safety');
    validateCommaDelimited(formData.food_intolerances, 'food_intolerances', 'Food intolerances', 'sec-safety');
    validateCommaDelimited(formData.dietary_restrictions, 'dietary_restrictions', 'Dietary restrictions', 'sec-safety');

    // Section 7: Medical Information
    validateCommaDelimited(formData.existing_conditions, 'existing_conditions', 'Existing conditions', 'sec-medical');
    validateCommaDelimited(formData.symptoms, 'symptoms', 'Symptoms', 'sec-medical');

    if (formData.medical_history) {
      const mhCheck = validateDescriptiveText(formData.medical_history, 'Medical history', false, 2000);
      if (!mhCheck.isValid) {
        errors.medical_history = mhCheck.error;
        if (!firstSec) firstSec = 'sec-medical';
      }
    }

    if (formData.supplements) {
      const supCheck = validateDescriptiveText(formData.supplements, 'Supplements', false, 1000);
      if (!supCheck.isValid) {
        errors.supplements = supCheck.error;
        if (!firstSec) firstSec = 'sec-medical';
      }
    }

    if (formData.medications && Array.isArray(formData.medications)) {
      formData.medications.forEach((med, idx) => {
        if (med.medication_name && med.medication_name.trim()) {
          const mCheck = validateDescriptiveText(med.medication_name, `Medication #${idx + 1}`, false, 150);
          if (!mCheck.isValid) {
            errors[`medications_${idx}`] = mCheck.error;
            if (!firstSec) firstSec = 'sec-medical';
          }
        }
      });
    }

    // Section 8: Ayurveda
    if (!formData.prakriti) {
      errors.prakriti = 'Please select an Ayurvedic Prakriti in Section 8.';
      if (!firstSec) firstSec = 'sec-ayurveda';
    }

    if (formData.vikriti) {
      const vikCheck = validateDescriptiveText(formData.vikriti, 'Vikriti', false, 500);
      if (!vikCheck.isValid) {
        errors.vikriti = vikCheck.error;
        if (!firstSec) firstSec = 'sec-ayurveda';
      }
    }

    if (formData.dietitian_observations) {
      const obsCheck = validateDescriptiveText(formData.dietitian_observations, 'Dietitian observations', false, 2000);
      if (!obsCheck.isValid) {
        errors.dietitian_observations = obsCheck.error;
        if (!firstSec) firstSec = 'sec-ayurveda';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstInvalidSection: firstSec,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateAssessmentData();
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      const firstErrorMsg = Object.values(validation.errors)[0];
      setFormError(firstErrorMsg || 'Please correct the highlighted fields before saving.');
      if (validation.firstInvalidSection) {
        setActiveTab(validation.firstInvalidSection);
      }
      return;
    }
    setFieldErrors({});

    // Parse array string fields
    const toArray = (val) =>
      val
        ? val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const payload = {
      ...formData,
      name: formData.name ? formData.name.trim() : patient?.name,
      patient_name: formData.name ? formData.name.trim() : patient?.name,
      age: formData.age !== '' && formData.age !== undefined ? parseInt(formData.age, 10) : patient?.age,
      sex: formData.sex || patient?.sex || 'male',
      occupation: formData.occupation !== undefined ? formData.occupation.trim() : (patient?.occupation || ''),
      meal_timings: toArray(formData.meal_timings),
      food_allergies: toArray(formData.food_allergies),
      food_intolerances: toArray(formData.food_intolerances),
      dietary_restrictions: toArray(formData.dietary_restrictions),
      existing_conditions: toArray(formData.existing_conditions),
      symptoms: toArray(formData.symptoms).map((s) => ({ symptom: s })),
      medications: formData.medications.filter((m) => m.medication_name && m.medication_name.trim().length > 0),
    };

    try {
      setSaving(true);
      await onSaveAssessment(payload);
    } catch (err) {
      setFormError(err.message || 'Failed to save patient assessment.');
    } finally {
      setSaving(false);
    }
  };

  const handlePatientPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Patient photo size must be less than 5 MB.');
      return;
    }

    try {
      const res = await api.uploadPatientPhoto(patient.id, file);
      const newPhotoUrl = res.data?.photo_url;
      if (newPhotoUrl && onUpdatePatientPhoto) {
        onUpdatePatientPhoto(patient.id, newPhotoUrl);
      }
    } catch (err) {
      console.error('Failed to upload patient photo:', err);
      setFormError(err.message || 'Failed to save patient photo to clinical record.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      {/* Patient Header Card */}
      <div className="patient-profile-card">
        <div className="profile-identity">
          <div className="profile-avatar-container" style={{ position: 'relative', flexShrink: 0 }}>
            {patient.photo_url ? (
              <img
                src={patient.photo_url}
                alt={patient.name}
                className="profile-avatar-img"
                style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
              />
            ) : (
              <div className="profile-avatar">{patient.name.charAt(0).toUpperCase()}</div>
            )}
            <label
              htmlFor={`patient-photo-input-${patient.id}`}
              className="profile-photo-change-btn"
              title="Upload patient photo"
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                border: '1.5px solid #FFFFFF',
              }}
            >
              <DashboardIcon name="camera" size={11} />
            </label>
            <input
              id={`patient-photo-input-${patient.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePatientPhotoUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="profile-info">
            <h2>{patient.name}</h2>
            <div className="profile-tags">
              <span className="profile-tag">ID: <strong>{patient.patient_code}</strong></span>
              <span className="profile-tag">{patient.age} yrs</span>
              <span className="profile-tag" style={{ textTransform: 'capitalize' }}>{patient.sex}</span>
              {patient.occupation && <span className="profile-tag">{patient.occupation}</span>}
              {patient.phone && (
                <span className="profile-tag">
                  <DashboardIcon name="clock" size={12} /> {patient.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="profile-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {onSwitchPatient && (
            <button
              type="button"
              className={`btn-patient-toggle ${showPatientSidebar ? 'active' : ''}`}
              onClick={onSwitchPatient}
              title="Toggle Patient Directory"
            >
              <DashboardIcon name="users" size={15} /> {showPatientSidebar ? 'Hide Patient List' : 'Switch Patient'}
            </button>
          )}

          {onOpenNewPatientModal && (
            <button
              type="button"
              className="btn-new-patient-mini"
              onClick={onOpenNewPatientModal}
              title="Register New Patient"
            >
              <DashboardIcon name="plus" size={14} /> New Patient
            </button>
          )}

          {onRequestDeletePatient && (
            <button
              type="button"
              className="btn-delete-patient-mini"
              onClick={() => onRequestDeletePatient(patient)}
              title={`Delete ${patient.name}`}
              aria-label={`Delete patient ${patient.name}`}
            >
              <DashboardIcon name="trash" size={14} /> Delete Patient
            </button>
          )}

          <div className="assessment-view-toggle">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'stepper' ? 'active' : ''}`}
              onClick={() => setViewMode('stepper')}
              title="Vertical Stepper Workflow"
            >
              <DashboardIcon name="clipboard-check" size={13} /> Stepper View
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
              title="View all 12 sections in continuous vertical flow"
            >
              <DashboardIcon name="file-text" size={13} /> All Sections View
            </button>
          </div>
        </div>
      </div>

      {formError && (
        <div className="toast-banner toast-error">
          <DashboardIcon name="shield-alert" size={16} />
          <span>{formError}</span>
        </div>
      )}

      {/* Vertical Assessment Layout */}
      <div className="assessment-vertical-layout">
        {/* Left Vertical Stepper Rail */}
        <aside className="assessment-vertical-stepper">
          <div className="vertical-stepper-header">
            <h4>Clinical Sections</h4>
            <span className="stepper-progress-pill">
              {viewMode === 'all' ? '12 Sections' : `Step ${SECTIONS.findIndex(s => s.id === activeTab) + 1} / ${SECTIONS.length}`}
            </span>
          </div>

          <div className="vertical-stepper-list">
            {SECTIONS.map((sec) => {
              const isActive = activeTab === sec.id;
              const isFilled = checkSectionFilled(sec.id, formData, labRecords, nutritionTargets, mealPlan, dietPlan);

              return (
                <button
                  key={sec.id}
                  type="button"
                  className={`vertical-stepper-item ${isActive && viewMode === 'stepper' ? 'active' : ''} ${isFilled ? 'completed' : ''}`}
                  onClick={() => {
                    setActiveTab(sec.id);
                    if (viewMode === 'all') {
                      const el = document.getElementById(sec.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  title={sec.label}
                >
                  <div className="stepper-item-left">
                    <span className="stepper-num-badge">
                      {isFilled && (!isActive || viewMode === 'all') ? (
                        <DashboardIcon name="check" size={12} />
                      ) : (
                        sec.num
                      )}
                    </span>
                    <span className="stepper-item-icon">
                      <DashboardIcon name={sec.iconName} size={15} />
                    </span>
                  </div>
                  <div className="stepper-item-text">
                    <span className="stepper-item-title">{sec.label.replace(/^\d+\.\s*/, '')}</span>
                    <span className="stepper-item-desc">{sec.desc}</span>
                  </div>
                  {isActive && viewMode === 'stepper' && <span className="stepper-active-indicator" />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Section Form Workspace */}
        <div className="assessment-active-workspace">

      {/* SECTION 1: BASIC DETAILS */}
      {(activeTab === 'sec-basic' || viewMode === 'all') && (
        <div className="form-card" id="sec-basic">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">1</span> Basic Patient Details
              </h3>
              <p className="section-subtitle">Core demographic and clinical consultation record</p>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Patient ID</label>
              <input type="text" className="form-input" value={patient.patient_code} disabled />
            </div>

            <div className="form-group">
              <label className="form-label">
                Patient Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                className="form-input"
                style={nameError || fieldErrors.name ? { borderColor: '#dc2626' } : {}}
                value={formData.name}
                onChange={handleNameChange}
                onKeyDown={handleNameKeyDown}
                placeholder="e.g. Vikram Joshi"
                required
              />
              {(nameError || fieldErrors.name) && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.name || nameError}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Date of Assessment <span className="required">*</span>
              </label>
              <input
                type="date"
                name="assessment_date"
                max={new Date().toISOString().split('T')[0]}
                className="form-input"
                style={fieldErrors.assessment_date ? { borderColor: '#dc2626' } : {}}
                value={formData.assessment_date}
                onChange={handleChange}
                required
              />
              {fieldErrors.assessment_date && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.assessment_date}
                </span>
              )}
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                name="age"
                min="0"
                max="105"
                className="form-input"
                style={fieldErrors.age ? { borderColor: '#dc2626' } : {}}
                value={formData.age}
                onChange={handleChange}
                placeholder="e.g. 46"
              />
              {fieldErrors.age && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.age}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Sex</label>
              <select
                name="sex"
                className="form-select"
                value={formData.sex}
                onChange={handleChange}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Occupation</label>
              <input
                type="text"
                name="occupation"
                className="form-input"
                style={fieldErrors.occupation ? { borderColor: '#dc2626' } : {}}
                value={formData.occupation}
                onChange={handleChange}
                placeholder="e.g. Civil Engineer"
              />
              {fieldErrors.occupation && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.occupation}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: BODY MEASUREMENTS */}
      {(activeTab === 'sec-body' || viewMode === 'all') && (
        <div className="form-card" id="sec-body">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">2</span> Body Measurements & Anthropometrics
              </h3>
              <p className="section-subtitle">
                Enter physiological measurements. Deterministic BMI, Mifflin-St Jeor BMR, and TDEE are computed in Section 10.
              </p>
            </div>
            {formData.height && formData.weight && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', borderColor: '#2d6a4f', color: '#1b4332', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={handleComputeTargets}
              >
                <DashboardIcon name="cpu" size={14} /> Compute Nutrition Targets →
              </button>
            )}
          </div>

          <div className="grid-4">
            <div className="form-group">
              <label className="form-label">Height (cm)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="300"
                name="height"
                className="form-input"
                style={fieldErrors.height ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 175"
                value={formData.height}
                onChange={handleChange}
              />
              {fieldErrors.height && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.height}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="500"
                name="weight"
                className="form-input"
                style={fieldErrors.weight ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 74.5"
                value={formData.weight}
                onChange={handleChange}
              />
              {fieldErrors.weight && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.weight}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Waist Circumference (cm)</label>
              <input
                type="number"
                step="0.5"
                min="30"
                max="250"
                name="waist_circumference"
                className="form-input"
                style={fieldErrors.waist_circumference ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 86"
                value={formData.waist_circumference}
                onChange={handleChange}
              />
              {fieldErrors.waist_circumference && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.waist_circumference}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Weight Trend</label>
              <select
                name="weight_trend"
                className="form-select"
                value={formData.weight_trend}
                onChange={handleChange}
              >
                <option value="stable">Stable</option>
                <option value="losing">Losing Weight</option>
                <option value="gaining">Gaining Weight</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DIET GOAL */}
      {(activeTab === 'sec-goal' || viewMode === 'all') && (
        <div className="form-card" id="sec-goal">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">3</span> Primary Dietary Goal
              </h3>
              <p className="section-subtitle">Specify the patient's primary therapeutic diet direction</p>
            </div>
          </div>

          <div className="option-cards-group" style={{ marginBottom: '1.25rem' }}>
            {DIET_GOALS.map((goal) => (
              <div
                key={goal.id}
                className={`option-card ${formData.diet_goal === goal.id ? 'selected' : ''}`}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, diet_goal: goal.id }));
                  if (fieldErrors.diet_goal) {
                    setFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.diet_goal;
                      return copy;
                    });
                  }
                }}
              >
                <div className="option-card-title">{goal.title}</div>
                <div className="option-card-desc">{goal.desc}</div>
              </div>
            ))}
          </div>
          {fieldErrors.diet_goal && (
            <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '-0.75rem', marginBottom: '1rem', display: 'block' }}>
              {fieldErrors.diet_goal}
            </span>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Optional Target Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="500"
                name="target_weight"
                className="form-input"
                style={fieldErrors.target_weight ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 68.0"
                value={formData.target_weight}
                onChange={handleChange}
              />
              {fieldErrors.target_weight && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.target_weight}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Goal Notes & Practitioner Objectives</label>
              <input
                type="text"
                name="goal_notes"
                className="form-input"
                style={fieldErrors.goal_notes ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Gradual weight reduction prioritizing Ama clearance and Agni stabilization"
                value={formData.goal_notes}
                onChange={handleChange}
              />
              {fieldErrors.goal_notes && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.goal_notes}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: LIFESTYLE */}
      {(activeTab === 'sec-lifestyle' || viewMode === 'all') && (
        <div className="form-card" id="sec-lifestyle">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">4</span> Lifestyle & Physical Activity
              </h3>
              <p className="section-subtitle">Daily movement habits, sleep pattern, and hydration</p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.15rem' }}>
            <label className="form-label">Daily Physical Activity Level</label>
            <div className="option-cards-group">
              {[
                { id: 'sedentary', title: 'Sedentary', desc: 'Desk job, little to no exercise' },
                { id: 'lightly_active', title: 'Lightly Active', desc: 'Light exercise 1-3 days/wk' },
                { id: 'moderately_active', title: 'Moderately Active', desc: 'Moderate workout 3-5 days/wk' },
                { id: 'very_active', title: 'Very Active', desc: 'Hard exercise 6-7 days/wk' },
                { id: 'extremely_active', title: 'Extremely Active', desc: 'Heavy physical labor or athlete' },
              ].map((lvl) => (
                <div
                  key={lvl.id}
                  className={`option-card ${formData.activity_level === lvl.id ? 'selected' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, activity_level: lvl.id }))}
                >
                  <div className="option-card-title">{lvl.title}</div>
                  <div className="option-card-desc">{lvl.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Exercise Type</label>
              <input
                type="text"
                name="exercise_type"
                className="form-input"
                style={fieldErrors.exercise_type ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Yoga, Brisk walking, Cycling"
                value={formData.exercise_type}
                onChange={handleChange}
              />
              {fieldErrors.exercise_type && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.exercise_type}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Exercise Frequency</label>
              <input
                type="text"
                name="exercise_frequency"
                className="form-input"
                style={fieldErrors.exercise_frequency ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 4 times per week"
                value={formData.exercise_frequency}
                onChange={handleChange}
              />
              {fieldErrors.exercise_frequency && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.exercise_frequency}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Exercise Duration</label>
              <input
                type="text"
                name="exercise_duration"
                className="form-input"
                style={fieldErrors.exercise_duration ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 45 minutes / session"
                value={formData.exercise_duration}
                onChange={handleChange}
              />
              {fieldErrors.exercise_duration && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.exercise_duration}
                </span>
              )}
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Sleep Duration (hours/night)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                name="sleep_duration"
                className="form-input"
                style={fieldErrors.sleep_duration ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 7"
                value={formData.sleep_duration}
                onChange={handleChange}
              />
              {fieldErrors.sleep_duration && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.sleep_duration}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Sleep Quality</label>
              <select
                name="sleep_quality"
                className="form-select"
                value={formData.sleep_quality}
                onChange={handleChange}
              >
                <option value="poor">Poor (Disturbed / Insomnia)</option>
                <option value="fair">Fair (Intermittent wakefulness)</option>
                <option value="good">Good (Restful)</option>
                <option value="excellent">Excellent (Deep & refreshing)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Water Intake (litres/day)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                name="water_intake"
                className="form-input"
                style={fieldErrors.water_intake ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 2.5"
                value={formData.water_intake}
                onChange={handleChange}
              />
              {fieldErrors.water_intake && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.water_intake}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: DIETARY PROFILE */}
      {(activeTab === 'sec-diet' || viewMode === 'all') && (
        <div className="form-card" id="sec-diet">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">5</span> Dietary Profile & Food Habits
              </h3>
              <p className="section-subtitle">Dietary classification, meal scheduling, and taste inclinations</p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              Dietary Category <span className="required">*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              {DIET_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  className={`btn-secondary ${formData.diet_category === cat.id ? 'btn-primary' : ''}`}
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, diet_category: cat.id }));
                    if (fieldErrors.diet_category) {
                      setFieldErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.diet_category;
                        return copy;
                      });
                    }
                  }}
                  style={{ minWidth: '120px' }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {fieldErrors.diet_category && (
              <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.5rem', display: 'block' }}>
                {fieldErrors.diet_category}
              </span>
            )}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Meal Frequency (meals/day)</label>
              <input
                type="number"
                min="1"
                max="8"
                name="meal_frequency"
                className="form-input"
                style={fieldErrors.meal_frequency ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. 3"
                value={formData.meal_frequency}
                onChange={handleChange}
              />
              {fieldErrors.meal_frequency && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.meal_frequency}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Current Meal Timings</label>
              <input
                type="text"
                name="meal_timings"
                className="form-input"
                style={fieldErrors.meal_timings ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Breakfast 8:30 AM, Lunch 1:30 PM, Dinner 8:30 PM"
                value={formData.meal_timings}
                onChange={handleChange}
              />
              {fieldErrors.meal_timings && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.meal_timings}
                </span>
              )}
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Food Preferences</label>
              <textarea
                name="food_preferences"
                className="form-textarea"
                style={fieldErrors.food_preferences ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Warm cooked meals, kheer, moong dal khichdi, seasonal fruits, ghee"
                value={formData.food_preferences}
                onChange={handleChange}
              />
              {fieldErrors.food_preferences && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.food_preferences}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Foods Disliked or Avoided</label>
              <textarea
                name="foods_disliked"
                className="form-textarea"
                style={fieldErrors.foods_disliked ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Bitter gourd, raw onion salads, chilled beverages, excessive tamarind"
                value={formData.foods_disliked}
                onChange={handleChange}
              />
              {fieldErrors.foods_disliked && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.foods_disliked}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: SAFETY RESTRICTIONS */}
      {(activeTab === 'sec-safety' || viewMode === 'all') && (
        <div className="form-card" id="sec-safety">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">6</span> Safety Restrictions & Sensitivities
              </h3>
              <p className="section-subtitle">Crucial food safety constraints, allergies, and clinical cautions</p>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Food Allergies</label>
              <textarea
                name="food_allergies"
                className="form-textarea"
                style={fieldErrors.food_allergies ? { borderColor: '#dc2626' } : {}}
                placeholder="Comma-separated: e.g. Peanuts, Shellfish, Tree nuts"
                value={formData.food_allergies}
                onChange={handleChange}
              />
              {fieldErrors.food_allergies && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.food_allergies}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Food Intolerances</label>
              <textarea
                name="food_intolerances"
                className="form-textarea"
                style={fieldErrors.food_intolerances ? { borderColor: '#dc2626' } : {}}
                placeholder="Comma-separated: e.g. Lactose, Gluten sensitivity, Fructose"
                value={formData.food_intolerances}
                onChange={handleChange}
              />
              {fieldErrors.food_intolerances && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.food_intolerances}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Dietary Restrictions</label>
              <textarea
                name="dietary_restrictions"
                className="form-textarea"
                style={fieldErrors.dietary_restrictions ? { borderColor: '#dc2626' } : {}}
                placeholder="Comma-separated: e.g. Low sodium, Diabetic carbohydrate limit, Renal potassium restriction"
                value={formData.dietary_restrictions}
                onChange={handleChange}
              />
              {fieldErrors.dietary_restrictions && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.dietary_restrictions}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: MEDICAL INFORMATION */}
      {(activeTab === 'sec-medical' || viewMode === 'all') && (
        <div className="form-card" id="sec-medical">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">7</span> Medical Information, Symptoms & Medications
              </h3>
              <p className="section-subtitle">Clinical history, active pharmacology, and symptoms</p>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Existing Conditions</label>
              <input
                type="text"
                name="existing_conditions"
                className="form-input"
                style={fieldErrors.existing_conditions ? { borderColor: '#dc2626' } : {}}
                placeholder="Comma-separated: e.g. Hypertension, Type 2 Diabetes, Hypothyroidism"
                value={formData.existing_conditions}
                onChange={handleChange}
              />
              {fieldErrors.existing_conditions && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.existing_conditions}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Active Symptoms (with frequency / severity)</label>
              <input
                type="text"
                name="symptoms"
                className="form-input"
                style={fieldErrors.symptoms ? { borderColor: '#dc2626' } : {}}
                placeholder="Comma-separated: e.g. Heartburn (moderate post dinner), Bloating (mild), Fatigue"
                value={formData.symptoms}
                onChange={handleChange}
              />
              {fieldErrors.symptoms && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.symptoms}
                </span>
              )}
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Medical History</label>
              <textarea
                name="medical_history"
                className="form-textarea"
                style={fieldErrors.medical_history ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Gallbladder stone history, appendectomy in 2018, family history of CAD"
                value={formData.medical_history}
                onChange={handleChange}
              />
              {fieldErrors.medical_history && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.medical_history}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Supplements & Herbal Formulations</label>
              <textarea
                name="supplements"
                className="form-textarea"
                style={fieldErrors.supplements ? { borderColor: '#dc2626' } : {}}
                placeholder="e.g. Triphala churna 3g at bedtime, Vitamin D3 60,000 IU weekly, Ashwagandha"
                value={formData.supplements}
                onChange={handleChange}
              />
              {fieldErrors.supplements && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.supplements}
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Medication Rows */}
          <div style={{ marginTop: '1.5rem' }}>
            <label className="form-label" style={{ fontSize: '0.95rem' }}>
              Current Prescription Medications ({formData.medications.length})
            </label>
            <p style={{ fontSize: '0.76rem', color: '#788d84', marginBottom: '0.5rem' }}>
              Add all active medications for potential diet-drug interaction checking in future phases.
            </p>

            {formData.medications.length > 0 && (
              <table className="dynamic-table">
                <thead>
                  <tr>
                    <th>Medication Name</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Purpose</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.medications.map((med, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Metformin"
                          value={med.medication_name}
                          onChange={(e) => handleMedicationChange(idx, 'medication_name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 500mg"
                          value={med.dosage}
                          onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Twice daily with meals"
                          value={med.frequency}
                          onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Glycemic control"
                          value={med.purpose}
                          onChange={(e) => handleMedicationChange(idx, 'purpose', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-remove-row"
                          onClick={() => handleRemoveMedication(idx)}
                          title="Remove medication"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button type="button" className="btn-add-row" onClick={handleAddMedication}>
              <span>+</span> Add Medication Row
            </button>
          </div>
        </div>
      )}

      {/* SECTION 8: AYURVEDIC INFORMATION */}
      {(activeTab === 'sec-ayurveda' || viewMode === 'all') && (
        <div className="form-card" id="sec-ayurveda">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">8</span> Ayurvedic Assessment & Doshic State
              </h3>
              <p className="section-subtitle">
                Prakriti constitution, Vikriti imbalances, Agni digestive fire, and seasonal rhythms
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">
              Patient Prakriti (Constitution) <span className="required">*</span>
            </label>
            <div className="prakriti-grid">
              {PRAKRITI_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={`prakriti-btn ${item.type} ${formData.prakriti === item.value ? 'selected' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, prakriti: item.value }))}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Vikriti (Current Doshic Imbalance)</label>
            <input
              type="text"
              name="vikriti"
              className="form-input"
              style={fieldErrors.vikriti ? { borderColor: '#dc2626' } : {}}
              placeholder="e.g. Aggravated Pitta with secondary Vata dryness, mild Ama signs"
              value={formData.vikriti}
              onChange={handleChange}
            />
            {fieldErrors.vikriti && (
              <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                {fieldErrors.vikriti}
              </span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Agni / Appetite State</label>
            <div className="option-cards-group">
              {APPETITE_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className={`option-card ${formData.appetite === opt.id ? 'selected' : ''}`}
                  onClick={() => setFormData((prev) => ({ ...prev, appetite: opt.id }))}
                >
                  <div className="option-card-title">{opt.title}</div>
                  <div className="option-card-desc">{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Digestion Pattern</label>
              <select
                name="digestion"
                className="form-select"
                value={formData.digestion}
                onChange={handleChange}
              >
                <option value="Normal">Normal & comfortable</option>
                <option value="Bloating">Bloating & fullness</option>
                <option value="Gas">Gas & flatulence</option>
                <option value="Acidity">Hyperacidity / Heartburn</option>
                <option value="Sluggish/Heavy">Sluggish / Post-meal heaviness</option>
                <option value="Irregular">Irregular & unpredictable</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Bowel Habits (Koshtha)</label>
              <select
                name="bowel_habits"
                className="form-select"
                value={formData.bowel_habits}
                onChange={handleChange}
              >
                <option value="Regular">Regular (Madhyama Koshtha)</option>
                <option value="Constipated">Constipated / Hard stools (Krura Koshtha)</option>
                <option value="Loose">Loose / Rapid transit (Mridu Koshtha)</option>
                <option value="Irregular">Irregular / Variable</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Meal Regularity</label>
              <select
                name="meal_regularity"
                className="form-select"
                value={formData.meal_regularity}
                onChange={handleChange}
              >
                <option value="regular">Regular daily meal timings</option>
                <option value="irregular">Irregular / Skipped meals</option>
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Season / Current Ritu</label>
              <select
                name="season_ritu"
                className="form-select"
                value={formData.season_ritu}
                onChange={handleChange}
              >
                {SEASONS.map((ritu) => (
                  <option key={ritu} value={ritu}>{ritu}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dietitian Observations & Classical Notes</label>
              <textarea
                name="dietitian_observations"
                className="form-textarea"
                style={fieldErrors.dietitian_observations ? { borderColor: '#dc2626' } : {}}
                placeholder="Clinical observations regarding tongue coating (Jihva), pulse notes (Nadi), complexion, or specific dietary recommendations."
                value={formData.dietitian_observations}
                onChange={handleChange}
              />
              {fieldErrors.dietitian_observations && (
                <span className="field-error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.dietitian_observations}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 9: CLINICAL & LABORATORY DATA (OPTIONAL) */}
      {(activeTab === 'sec-lab' || viewMode === 'all') && (
        <div className="form-card" id="sec-lab">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">9</span> Clinical & Laboratory Data (Optional)
              </h3>
              <p className="section-subtitle">
                Record diagnostic biomarkers and report upload metadata. Dietitians can verify, edit, or remove entries.
              </p>
            </div>

            {existingAssessment ? (
              <button
                type="button"
                className="btn-new-patient"
                onClick={onOpenLabModal}
              >
                <DashboardIcon name="plus" size={13} /> Add Lab Test
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#c98a3e', background: '#fef7ed', padding: '0.3rem 0.75rem', borderRadius: '6px' }}>
                Save the assessment first to link laboratory biomarker records.
              </div>
            )}
          </div>

          {labRecords.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#788d84' }}>
              <div style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
                <DashboardIcon name="flask" size={32} />
              </div>
              <p style={{ fontWeight: 500 }}>No clinical or laboratory records entered yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                This section is optional. You can record blood panels (Glucose, Lipids, LFT, KFT, Thyroid) and store report metadata.
              </p>
              {existingAssessment && (
                <button
                  type="button"
                  className="btn-add-row"
                  onClick={onOpenLabModal}
                  style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <DashboardIcon name="plus" size={13} /> Add First Lab Record
                </button>
              )}
            </div>
          ) : (
            <table className="dynamic-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Observed Value</th>
                  <th>Unit</th>
                  <th>Reference Range</th>
                  <th>Test Date</th>
                  <th>Laboratory</th>
                  <th>Status</th>
                  <th>Attached File</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {labRecords.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.test_name}</strong></td>
                    <td style={{ fontWeight: 600 }}>{item.value}</td>
                    <td>{item.unit || '—'}</td>
                    <td>{item.reference_range || '—'}</td>
                    <td>{item.test_date ? item.test_date.split('T')[0] : '—'}</td>
                    <td>{item.source_laboratory || '—'}</td>
                    <td>
                      <span className={`badge-flag ${item.reported_flag ? `badge-${item.reported_flag}` : 'badge-undetermined'}`}>
                        {item.reported_flag || 'Unable to determine'}
                      </span>
                    </td>
                    <td>
                      {item.report_file_metadata ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '0.76rem', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <DashboardIcon name="file-text" size={13} /> {item.report_file_metadata.fileName}
                          </span>
                          {onDeleteLabAttachment && (
                            <button
                              type="button"
                              onClick={() => onDeleteLabAttachment(item)}
                              title="Remove attached file metadata"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                padding: '0 0.25rem',
                                fontSize: '1rem',
                                lineHeight: 1,
                              }}
                              aria-label={`Delete attachment for ${item.test_name}`}
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: '1px solid #e2ece7',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                          }}
                          onClick={() => onEditLabRecord(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-remove-row"
                          onClick={() => onDeleteLabRecord(item.id)}
                          title="Delete lab record"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SECTION 10: NUTRITION TARGETS (DETERMINISTIC ENGINE) */}
      {(activeTab === 'sec-nutrition' || viewMode === 'all') && (
        <div className="form-card" id="sec-nutrition">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">10</span> Deterministic Nutrition Targets & Personalization
              </h3>
              <p className="section-subtitle">
                Deterministic clinical targets computed using validated Mifflin-St Jeor BMR, PAL activity multipliers, and classical Ayurvedic dosha guidelines.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleComputeTargets}
              disabled={loadingTargets}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <DashboardIcon name="cpu" size={15} />
              <span>{loadingTargets ? 'Computing...' : 'Recompute Targets'}</span>
            </button>
          </div>

          <NutritionTargetsView
            targets={nutritionTargets}
            loading={loadingTargets}
            onRecalculate={handleComputeTargets}
            error={targetError}
          />
        </div>
      )}

      {/* SECTION 11: FOOD & MEAL PLAN (DETERMINISTIC ENGINE) */}
      {(activeTab === 'sec-mealplan' || viewMode === 'all') && (
        <div className="form-card" id="sec-mealplan">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">11</span> Deterministic Food & Meal Planning
              </h3>
              <p className="section-subtitle">
                Constructs grounded, Ayurvedic-aligned, macro-balanced daily meal plans with portion sizing, transparent scoring explanations, and clinical substitutions.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerateMealPlan}
              disabled={loadingPlan}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <DashboardIcon name="utensils" size={15} />
              <span>{loadingPlan ? 'Generating Plan...' : 'Generate Meal Plan'}</span>
            </button>
          </div>

          <MealPlanView
            mealPlan={mealPlan}
            loading={loadingPlan}
            onGeneratePlan={handleGenerateMealPlan}
            onSavePlan={handleSaveMealPlan}
            error={planError}
            savingPlan={savingPlan}
          />
        </div>
      )}

      {/* SECTION 12: 7-DAY DIET PLAN (GEMINI POWERED) */}
      {(activeTab === 'sec-dietplan' || viewMode === 'all') && (
        <div className="form-card" id="sec-dietplan">
          <div className="section-header">
            <div>
              <h3 className="section-title">
                <span className="section-number-pill">12</span> Gemini-Powered 7-Day Diet Plan
              </h3>
              <p className="section-subtitle">
                Comprehensive 7-day clinical meal schedule for registered dietitians. Formatted by Gemini with daily staple rotations, authentic Ayurvedic culinary instructions, and strict post-generation deterministic guardrails.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleGenerateDietPlan()}
              disabled={loadingDietPlan}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <DashboardIcon name="calendar-days" size={15} />
              <span>{loadingDietPlan ? 'Generating 7-Day Plan...' : 'Generate 7-Day Plan'}</span>
            </button>
          </div>

          <DietPlanView
            patient={patient}
            existingAssessment={existingAssessment}
            nutritionTargets={nutritionTargets}
            isTargetsStale={isTargetsStale}
            targetFreshnessError={freshnessCheck.error}
            onGoToSection10={() => setActiveTab('sec-nutrition')}
            dietPlan={dietPlan}
            onGeneratePlan={handleGenerateDietPlan}
            onDietPlanUpdated={(updated) => {
              setDietPlan(updated);
              if (onDietPlanSaved) onDietPlanSaved(updated);
            }}
            loading={loadingDietPlan}
            error={dietPlanError}
          />
        </div>
      )}

      {/* Floating Action Footer */}
      <div className="action-footer" style={{ marginTop: '1.25rem' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: '#4a5d55' }}>
            {viewMode === 'all'
              ? 'All 12 Clinical Sections Displayed Vertically'
              : `Section ${SECTIONS.findIndex((s) => s.id === activeTab) + 1} of ${SECTIONS.length}: ${SECTIONS.find((s) => s.id === activeTab)?.label}`
            }
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Step navigation buttons */}
          {viewMode === 'stepper' && activeTab !== 'sec-basic' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === activeTab);
                if (idx > 0) setActiveTab(SECTIONS[idx - 1].id);
              }}
            >
              ← Previous Section
            </button>
          )}

          {viewMode === 'stepper' && activeTab !== 'sec-dietplan' && (
            <button
              type="button"
              className="btn-primary"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === activeTab);
                if (idx < SECTIONS.length - 1) setActiveTab(SECTIONS[idx + 1].id);
              }}
            >
              Next Section →
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: '#2d6a4f', color: '#1b4332', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={handleComputeTargets}
            disabled={loadingTargets}
          >
            <DashboardIcon name="cpu" size={14} />
            <span>Targets</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: '#0f766e', color: '#0f766e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={handleGenerateMealPlan}
            disabled={loadingPlan}
          >
            <DashboardIcon name="utensils" size={14} />
            <span>{activeTab === 'sec-mealplan' ? 'Regenerate Day' : '1-Day Plan'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: '#1b4332', color: '#1b4332', fontWeight: 700, backgroundColor: activeTab === 'sec-dietplan' ? '#e8f5e9' : 'transparent', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => {
              if (!dietPlan) {
                handleGenerateDietPlan();
              } else {
                setActiveTab('sec-dietplan');
              }
            }}
            disabled={loadingDietPlan}
          >
            <DashboardIcon name="calendar-days" size={14} />
            <span>{loadingDietPlan ? 'Generating...' : activeTab === 'sec-dietplan' ? '7-Day Plan' : '7-Day Diet Plan'}</span>
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <DashboardIcon name="check" size={14} />
            <span>{saving ? 'Saving...' : existingAssessment ? 'Update Assessment' : 'Save Assessment'}</span>
          </button>
        </div>
      </div>

        </div> {/* Close assessment-active-workspace */}
      </div> {/* Close assessment-vertical-layout */}

    </form>
  );
}
