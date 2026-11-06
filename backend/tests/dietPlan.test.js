const request = require('supertest');
const app = require('../src/app');
const dietPlanRepository = require('../src/repositories/dietPlanRepository');
const patientRepository = require('../src/repositories/patientRepository');
const aiService = require('../src/services/aiService');

describe('Gemini 7-Day Diet Plan APIs (Phase 6)', () => {
  const mockDietPlan = {
    plan_id: 'dp_test_abc123',
    patient_id: 1,
    assessment_id: 1,
    title: '7-Day Personalized Ayurvedic Diet Plan',
    status: 'validated',
    patient_summary: 'Adult male, 42 yrs, Pitta constitution with balanced agni.',
    clinical_rationale: 'Calibrated daily energy of ~2000 kcal with balanced macronutrients.',
    ayurvedic_dietary_principles: [
      'Ahara Vidhi Vidhana: Warm, freshly prepared meals.',
      'Shad Rasa: Inclusion of all six tastes.',
    ],
    dosha_guidelines: {
      pitta: 'Favor cooling, sweet, and moderately spiced dishes.',
    },
    days: [
      {
        day_number: 1,
        day_name: 'Day 1 (Monday)',
        theme: 'Restorative Agni Rekindling',
        daily_summary: 'Easily digestible warm breakfast, wholesome lunch, and light dinner.',
        clinical_rationale: 'Balanced glycemic response.',
        ayurvedic_notes: 'Pitta pacifying and light.',
        daily_totals: {
          calories: 1980.0,
          protein_g: 65.0,
          carbohydrate_g: 260.0,
          fat_g: 50.0,
          fiber_g: 30.0,
        },
        meals: [
          {
            meal_id: 'meal_breakfast',
            meal_type: 'breakfast',
            timing: '08:00 AM - 08:30 AM',
            meal_summary: 'Warm rolled oats with spiced stewed apples.',
            totals: {
              calories: 450.0,
              protein_g: 14.0,
              carbohydrate_g: 65.0,
              fat_g: 9.0,
              fiber_g: 8.0,
            },
            foods: [
              {
                food_id: 'cereal_rolled_oats',
                food_name: 'Rolled Oats',
                quantity: 60.0,
                unit: 'g',
                preparation_notes: 'Simmer with warm water, dash of cinnamon.',
                calories: 230.0,
                protein_g: 8.0,
                carbohydrate_g: 40.0,
                fat_g: 4.0,
                fiber_g: 6.0,
              },
            ],
          },
        ],
      },
    ],
    weekly_overview: 'Staple grain and legume rotations across the 7 days.',
    general_instructions: ['Drink warm water', '3.5 hour gap between meals'],
    evidence_citations: [{ document: 'ICMR NIN', page: 40 }],
    validation_results: {
      passed: true,
      errors: [],
      warnings: [],
      requires_dietitian_review: false,
    },
    dietitian_notes: 'Clinical notes for Arun Kumar.',
    is_approved: false,
  };

  beforeEach(async () => {
    dietPlanRepository._resetMemoryStore();
    patientRepository._resetMemoryStore();
    jest.restoreAllMocks();
    await patientRepository.create({
      name: 'Arun Kumar',
      age: 42,
      sex: 'male',
      dietitian_id: 1,
    });
    await patientRepository.create({
      name: 'Sneha Patel',
      age: 38,
      sex: 'female',
      dietitian_id: 1,
    });
  });

  describe('POST /api/diet-plan/generate', () => {
    it('should reject generation when patient_assessment is missing', async () => {
      const res = await request(app)
        .post('/api/diet-plan/generate')
        .send({ dietitian_notes: 'Some notes' });

      expect(res.status).toBe(400);
      expect(['fail', 'error']).toContain(res.body.status);
      expect(res.body.message).toMatch(/patient_assessment/);
    });

    it('should generate, validate, and persist a 7-day diet plan', async () => {
      jest.spyOn(aiService, 'generate7DayDietPlan').mockResolvedValue(mockDietPlan);

      const res = await request(app)
        .post('/api/diet-plan/generate')
        .send({
          patient_assessment: {
            patient_id: 1,
            age: 42,
            sex: 'male',
            height: 174,
            weight: 76,
            diet_goal: 'weight_maintenance',
          },
          dietitian_notes: 'Focus on cooling foods.',
          save: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.title).toBe('7-Day Personalized Ayurvedic Diet Plan');
      expect(res.body.data.days).toHaveLength(1);
      expect(res.body.data.id).toBeDefined();

      // Verify stored in repository
      const stored = await dietPlanRepository.findById(res.body.data.id);
      expect(stored).not.toBeNull();
      expect(stored.patient_id).toBe(1);
    });
  });

  describe('GET /api/diet-plan/:id', () => {
    it('should return 404 for non-existent diet plan', async () => {
      const res = await request(app).get('/api/diet-plan/99999');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });

    it('should retrieve existing diet plan by numeric ID or string plan_id', async () => {
      const saved = await dietPlanRepository.create(mockDietPlan);

      const res = await request(app).get(`/api/diet-plan/${saved.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.plan_id).toBe('dp_test_abc123');

      // Test retrieval by string plan_id
      const resByPlanId = await request(app).get(`/api/diet-plan/dp_test_abc123`);
      expect(resByPlanId.status).toBe(200);
      expect(resByPlanId.body.data.id).toBe(saved.id);
    });
  });

  describe('GET /api/diet-plan/patient/:patientId', () => {
    it('should retrieve all diet plans for a patient', async () => {
      await dietPlanRepository.create({ ...mockDietPlan, patient_id: 2 });
      await dietPlanRepository.create({ ...mockDietPlan, patient_id: 2, plan_id: 'dp_2nd' });

      const res = await request(app).get('/api/diet-plan/patient/2');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/diet-plan/validate', () => {
    it('should reject validation if required objects are missing', async () => {
      const res = await request(app).post('/api/diet-plan/validate').send({});
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('should proxy revalidation to AI Service', async () => {
      const mockValResult = {
        passed: true,
        errors: [],
        warnings: [],
        requires_dietitian_review: false,
        macro_tolerance_passed: true,
      };

      jest.spyOn(aiService, 'validateDietPlan').mockResolvedValue(mockValResult);

      const res = await request(app)
        .post('/api/diet-plan/validate')
        .send({
          diet_plan: mockDietPlan,
          patient_assessment: { patient_id: 1, allergies: [] },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.passed).toBe(true);
    });
  });

  describe('PUT /api/diet-plan/:id', () => {
    it('should update plan fields and reset approval status', async () => {
      const saved = await dietPlanRepository.create({
        ...mockDietPlan,
        is_approved: true,
        status: 'approved',
      });

      const res = await request(app)
        .put(`/api/diet-plan/${saved.id}`)
        .send({
          dietitian_notes: 'Updated notes after follow-up.',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.dietitian_notes).toBe('Updated notes after follow-up.');
      expect(res.body.data.is_approved).toBe(false);
      expect(res.body.data.status).toBe('needs_review');
    });
  });

  describe('POST /api/diet-plan/:id/approve', () => {
    it('should mark diet plan as formally approved', async () => {
      const saved = await dietPlanRepository.create(mockDietPlan);

      const res = await request(app)
        .post(`/api/diet-plan/${saved.id}/approve`)
        .send({ approved_by: 'dr_sharma' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.is_approved).toBe(true);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.approved_by).toBe('dr_sharma');
      expect(res.body.data.approved_at).toBeDefined();
    });
  });
});
