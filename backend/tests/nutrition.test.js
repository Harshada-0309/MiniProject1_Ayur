const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const aiService = require('../src/services/aiService');

describe('Deterministic Nutrition Target APIs (Phase 3)', () => {
  let patientId;
  let assessmentId;

  const mockCalculationResult = {
    patient_id: 'PAT-TEST-1',
    assessment_id: 1,
    anthropometrics: {
      height_cm: 175,
      weight_kg: 75,
      bmi: 24.49,
      bmi_status: 'Normal weight',
      waist_circumference_cm: 85,
      weight_trend: 'stable',
    },
    energy: {
      bmr_kcal_day: 1680.0,
      formula: 'Mifflin-St Jeor (1990)',
      activity_level: 'sedentary',
      activity_multiplier: 1.2,
      tdee_kcal_day: 2016.0,
      goal: 'weight_loss',
      target_energy_kcal_day: 1516.0,
      adjustment_kcal_day: -500.0,
      adjustment_method: 'Weight loss caloric reduction (-500 kcal/day)',
    },
    macros: {
      protein_g_day: 90.0,
      protein_kcal_day: 360.0,
      protein_pct: 23.7,
      protein_factor_g_kg: 1.2,
      protein_method: '1.2 g/kg/day target',
      carbohydrate_g_day: 194.2,
      carbohydrate_kcal_day: 777.0,
      carbohydrate_pct: 51.3,
      fat_g_day: 42.1,
      fat_kcal_day: 379.0,
      fat_pct: 25.0,
      total_macro_kcal: 1516.0,
    },
    other_targets: {
      fiber_g_day: 21.2,
      fiber_method: '14 g per 1,000 kcal target',
      water_ml_day: 2625.0,
      water_method: '35 ml/kg baseline',
    },
    ayurvedic_profile: {
      prakriti: 'Pitta-Kapha',
      vikriti: 'Pitta aggravation with mild ama',
      appetite_agni: 'Tikshnagni (Sharp/High)',
      season_ritu: 'Sharad (Autumn)',
      primary_doshas: ['Pitta', 'Kapha'],
      tastes_to_emphasize: ['Sweet', 'Bitter', 'Astringent'],
      tastes_to_pacify_or_moderate: ['Pungent', 'Sour', 'Salty'],
      qualities_guidance: 'Cooling, light, moderately dry qualities advised',
      digestive_guidance: 'Avoid hot spicy preparations; consume regular cooling meals',
    },
    calculation_metadata: {
      formulas_used: [
        'BMI: weight (kg) / (height (m))^2',
        'BMR: Mifflin-St Jeor equation',
      ],
      assumptions: ['Resting metabolic rate estimated via Mifflin-St Jeor'],
      warnings: [],
      disclaimer: 'AyurDiet Nutrition Engine provides deterministic calculations to support professional dietitians.',
    },
    condition_specific: false,
    requires_knowledge_grounded_guidance: false,
  };

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    jest.restoreAllMocks();

    // Create a base patient
    const pRes = await request(app).post('/api/patients').send({
      name: 'Ananya Sharma',
      age: 34,
      sex: 'female',
      occupation: 'Software Engineer',
    });
    patientId = pRes.body.data.patient.id;

    // Create an assessment
    const aRes = await request(app)
      .post(`/api/patients/${patientId}/assessments`)
      .send({
        assessment_date: '2026-09-25',
        height: 165,
        weight: 62,
        diet_goal: 'weight_maintenance',
        activity_level: 'moderately_active',
        diet_category: 'vegetarian',
        prakriti: 'Pitta',
      });
    assessmentId = aRes.body.data.assessment.id;
  });

  describe('POST /api/nutrition/calculate', () => {
    it('should invoke calculation engine and return 200 with deterministic results', async () => {
      jest.spyOn(aiService, 'calculateNutrition').mockResolvedValueOnce(mockCalculationResult);

      const res = await request(app)
        .post('/api/nutrition/calculate')
        .send({
          age: 34,
          sex: 'female',
          height: 165,
          weight: 62,
          diet_goal: 'weight_maintenance',
          activity_level: 'moderately_active',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.energy.bmr_kcal_day).toBe(1680.0);
      expect(res.body.data.macros.protein_g_day).toBe(90.0);
      expect(aiService.calculateNutrition).toHaveBeenCalledTimes(1);
    });

    it('should return 422 if calculation engine returns validation error', async () => {
      const valError = new Error('Height must be positive');
      valError.status = 422;
      valError.details = { errors: [{ field: 'height', message: 'Value too small' }] };
      jest.spyOn(aiService, 'calculateNutrition').mockRejectedValueOnce(valError);

      const res = await request(app)
        .post('/api/nutrition/calculate')
        .send({
          age: 30,
          sex: 'male',
          height: 170,
          weight: 70,
          diet_goal: 'weight_loss',
        });

      expect(res.status).toBe(422);
      expect(res.body.status).toBe('fail');
      expect(res.body.details).toBeDefined();
    });

    it('should return 503 if AI service is unreachable', async () => {
      const netError = new Error('AI Service connection error: ECONNREFUSED');
      netError.status = 503;
      jest.spyOn(aiService, 'calculateNutrition').mockRejectedValueOnce(netError);

      const res = await request(app)
        .post('/api/nutrition/calculate')
        .send({ age: 30, sex: 'male', height: 170, weight: 70, diet_goal: 'weight_loss' });

      expect(res.status).toBe(503);
    });
  });

  describe('GET & POST /api/nutrition/assessments/:id/calculate', () => {
    it('should compute targets for a saved assessment via GET', async () => {
      jest.spyOn(aiService, 'calculateNutrition').mockResolvedValueOnce(mockCalculationResult);

      const res = await request(app).get(`/api/nutrition/assessments/${assessmentId}/calculate`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.anthropometrics.bmi).toBe(24.49);
      expect(aiService.calculateNutrition).toHaveBeenCalledWith(
        expect.objectContaining({
          age: 34,
          sex: 'female',
          height: 165,
          weight: 62,
          diet_goal: 'weight_maintenance',
        })
      );
    });

    it('should compute targets for a saved assessment via POST', async () => {
      jest.spyOn(aiService, 'calculateNutrition').mockResolvedValueOnce(mockCalculationResult);

      const res = await request(app).post(`/api/nutrition/assessments/${assessmentId}/calculate`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.ayurvedic_profile.prakriti).toBe('Pitta-Kapha');
    });

    it('should return 404 for non-existent assessment', async () => {
      const res = await request(app).get('/api/nutrition/assessments/99999/calculate');

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toContain('not found');
    });
  });
});
