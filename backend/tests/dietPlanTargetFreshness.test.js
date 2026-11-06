const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const dietPlanRepository = require('../src/repositories/dietPlanRepository');
const aiService = require('../src/services/aiService');
const { validateNutritionTargetFreshness } = require('../src/middleware/validation');

describe('Section 10 / Section 12 Diet Plan Nutrition Target Freshness', () => {
  const EXPECTED_ERROR = 'Deterministic nutrition targets are out of date or missing. Please recompute targets in Section 10 before generating a 7-day diet plan.';

  const mockDietPlanResponse = {
    plan_id: 'plan_freshness_test_1',
    patient_id: 1,
    title: '7-Day Personalized Ayurvedic Diet Plan',
    status: 'draft',
    patient_summary: 'Test patient summary',
    clinical_rationale: 'Balanced Pitta-Kapha dietary approach',
    ayurvedic_dietary_principles: ['Warm food', 'Regular timings'],
    dosha_guidelines: { vata: 'moderation', pitta: 'pacify', kapha: 'pacify' },
    days: [
      {
        day_number: 1,
        day_name: 'Monday',
        theme: 'Digestive Reset',
        meals: {
          breakfast: { time: '08:00', name: 'Moong Dal Cheela', items: ['Moong dal cheela', 'Mint chutney'] },
          lunch: { time: '13:00', name: 'Khichdi', items: ['Khichdi with ghee', 'Cucumber raita'] },
          dinner: { time: '19:30', name: 'Vegetable Soup', items: ['Lentil soup', 'Steamed zucchini'] },
        },
      },
    ],
    weekly_overview: { highlights: 'Low glycemic index meals' },
    general_instructions: ['Drink warm water'],
    evidence_citations: ['Charaka Samhita Sutrasthana 27'],
    validation_results: { passed: true, score: 95 },
  };

  const validTargets = {
    patient_id: 1,
    assessment_id: 101,
    energy: {
      target_energy_kcal_day: 1850,
      age: 42,
      sex: 'male',
      activity_level: 'sedentary',
      goal: 'weight_loss',
    },
    anthropometrics: {
      height_cm: 175,
      weight_kg: 78,
    },
    target_energy_kcal_day: 1850,
    macronutrients: {
      protein_g: 75,
      carbohydrates_g: 220,
      fat_g: 45,
    },
  };

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    dietPlanRepository._resetMemoryStore();

    await patientRepository.create({
      id: 1,
      name: 'Rohan Mehra',
      age: 42,
      sex: 'male',
      dietitian_id: 1,
    });

    jest.spyOn(aiService, 'generate7DayDietPlan').mockResolvedValue(mockDietPlanResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateNutritionTargetFreshness Unit Validation', () => {
    it('should reject missing, null, or empty targets', () => {
      expect(validateNutritionTargetFreshness({ nutritionTargets: null }).valid).toBe(false);
      expect(validateNutritionTargetFreshness({ nutritionTargets: null }).error).toBe(EXPECTED_ERROR);
      expect(validateNutritionTargetFreshness({ nutritionTargets: {} }).valid).toBe(false);
      expect(validateNutritionTargetFreshness({ nutritionTargets: { some_field: 123 } }).valid).toBe(false);
    });

    it('should reject targets belonging to a different patient', () => {
      const mismatchedPatientTargets = { ...validTargets, patient_id: 999 };
      const res = validateNutritionTargetFreshness({
        nutritionTargets: mismatchedPatientTargets,
        patient: { id: 1, patient_code: 'PAT-001' },
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe(EXPECTED_ERROR);
    });

    it('should reject targets belonging to a different assessment', () => {
      const mismatchedAssessmentTargets = { ...validTargets, assessment_id: 202 };
      const res = validateNutritionTargetFreshness({
        nutritionTargets: mismatchedAssessmentTargets,
        patient: { id: 1 },
        assessment: { id: 101 },
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe(EXPECTED_ERROR);
    });

    it('should reject when anthropometric measurements have changed (stale targets)', () => {
      const currentInputs = {
        height: 180, // changed from 175
        weight: 78,
        age: 42,
        sex: 'male',
        activity_level: 'sedentary',
        diet_goal: 'weight_loss',
      };
      const res = validateNutritionTargetFreshness({
        nutritionTargets: validTargets,
        currentInputs,
        patient: { id: 1 },
        assessment: { id: 101 },
      });
      expect(res.valid).toBe(false);
      expect(res.isStale).toBe(true);
      expect(res.error).toBe(EXPECTED_ERROR);
    });

    it('should accept targets with decimal vs integer formatting differences (e.g. 175.00 vs 175)', () => {
      const currentInputs = {
        height: '175.00',
        weight: '78.00',
        age: '42',
        sex: 'male',
        activity_level: 'sedentary',
        diet_goal: 'weight_loss',
      };
      const res = validateNutritionTargetFreshness({
        nutritionTargets: validTargets,
        currentInputs,
        patient: { id: 1 },
        assessment: { id: 101 },
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });

    it('should accept fresh valid targets matching patient and assessment', () => {
      const currentInputs = {
        height: 175,
        weight: 78,
        age: 42,
        sex: 'male',
        activity_level: 'sedentary',
        diet_goal: 'weight_loss',
      };
      const res = validateNutritionTargetFreshness({
        nutritionTargets: validTargets,
        currentInputs,
        patient: { id: 1 },
        assessment: { id: 101 },
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });
  });

  describe('POST /api/diet-plan/generate Freshness Endpoint Integration', () => {
    it('should reject generation with 400 when nutrition_targets is empty or invalid', async () => {
      const res = await request(app)
        .post('/api/diet-plan/generate')
        .send({
          patient_assessment: {
            patient_id: 1,
            assessment_id: 101,
            height: 175,
            weight: 78,
            diet_goal: 'weight_loss',
            diet_category: 'vegetarian',
          },
          nutrition_targets: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe(EXPECTED_ERROR);
    });

    it('should reject generation when targets belong to another patient', async () => {
      const res = await request(app)
        .post('/api/diet-plan/generate')
        .send({
          patient_assessment: {
            patient_id: 1,
            assessment_id: 101,
            height: 175,
            weight: 78,
            diet_goal: 'weight_loss',
            diet_category: 'vegetarian',
          },
          nutrition_targets: {
            ...validTargets,
            patient_id: 999, // different patient
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe(EXPECTED_ERROR);
    });

    it('should reject generation when measurements are stale compared to Section 10 computation', async () => {
      const res = await request(app)
        .post('/api/diet-plan/generate')
        .send({
          patient_assessment: {
            patient_id: 1,
            assessment_id: 101,
            height: 185, // modified in Section 2 after computing Section 10
            weight: 85,  // modified
            diet_goal: 'weight_loss',
            diet_category: 'vegetarian',
          },
          nutrition_targets: validTargets,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe(EXPECTED_ERROR);
    });

    it('should succeed and generate diet plan when fresh recomputed targets are provided', async () => {
      const res = await request(app)
        .post('/api/diet-plan/generate')
        .send({
          patient_assessment: {
            patient_id: 1,
            assessment_id: 101,
            height: '175.00', // matches PostgreSQL decimal string format
            weight: '78.00',
            age: 42,
            sex: 'male',
            activity_level: 'sedentary',
            diet_goal: 'weight_loss',
            diet_category: 'vegetarian',
          },
          nutrition_targets: validTargets,
          save: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.title).toBe('7-Day Personalized Ayurvedic Diet Plan');
      expect(res.body.data.nutrition_targets).toBeDefined();
      expect(res.body.data.nutrition_targets.energy.target_energy_kcal_day).toBe(1850);

      // Verify persistence in repository includes nutrition_targets
      const savedRecord = await dietPlanRepository.findById(res.body.data.id);
      expect(savedRecord).not.toBeNull();
      expect(savedRecord.validation_results?.nutrition_targets).toBeDefined();
      expect(savedRecord.validation_results.nutrition_targets.target_energy_kcal_day).toBe(1850);
    });
  });
});
