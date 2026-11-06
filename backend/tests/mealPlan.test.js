const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const mealPlanRepository = require('../src/repositories/mealPlanRepository');
const aiService = require('../src/services/aiService');

describe('Food & Meal Planning Engine APIs (Phase 5)', () => {
  let patientId;
  let assessmentId;

  const mockPlan = {
    patient_id: 1,
    assessment_id: 1,
    plan_status: 'validated',
    nutrition_targets: {
      energy: { target_energy_kcal_day: 1500.0 },
      macros: { protein_g_day: 60.0, carbohydrate_g_day: 200.0, fat_g_day: 40.0 },
    },
    meals: [
      {
        meal_id: 'meal_breakfast',
        meal_type: 'breakfast',
        target_calories: 375.0,
        foods: [
          {
            food_id: 'cereal_rolled_oats',
            food_name: 'Rolled Oats (Cooked in Water)',
            category: 'cereal_grain',
            quantity: 200.0,
            unit: 'g',
            nutrition: { basis: '200g', calories: 136.0, protein_g: 5.0, carbohydrate_g: 24.0, fat_g: 2.8, fiber_g: 3.4 },
            selection_reason: 'High soluble beta-glucan fiber',
            ayurvedic_alignment: 'Tridoshic pacifying',
            sources: [{ document: 'IFCT', page: 50 }],
            requires_dietitian_review: false,
          },
        ],
        totals: { calories: 136.0, protein_g: 5.0, carbohydrate_g: 24.0, fat_g: 2.8, fiber_g: 3.4 },
      },
    ],
    daily_totals: { calories: 1480.0, protein_g: 58.0, carbohydrate_g: 195.0, fat_g: 38.0, fiber_g: 25.0 },
    target_comparison: {
      targets: { calories: 1500.0, protein: 60.0, carbohydrate: 200.0, fat: 40.0 },
      actual: { calories: 1480.0, protein: 58.0, carbohydrate: 195.0, fat: 38.0 },
      difference: { calories: -20.0, protein: -2.0, carbohydrate: -5.0, fat: -2.0 },
      within_target: true,
      tolerances_pct: { calories: 7.5, protein: 10.0, carbohydrate: 10.0, fat: 10.0 },
    },
    validation: {
      valid: true,
      warnings: [],
      errors: [],
      requires_dietitian_review: false,
      review_reasons: [],
    },
    evidence: [{ document: 'IFCT', page: 50 }],
    requires_dietitian_review: false,
    review_reasons: [],
  };

  const mockFoods = [
    {
      food_id: 'cereal_red_rice',
      food_name: 'Red Rice (Cooked)',
      category: 'cereal_grain',
      nutrition: { basis: '100g', calories: 111.0, protein_g: 2.6, carbohydrate_g: 23.5, fat_g: 0.9, fiber_g: 1.8 },
      serving: { default_quantity: 150.0, unit: 'g', min_quantity: 50.0, max_quantity: 250.0, step_size: 25.0 },
      ayurvedic: { rasa: ['madhura'], guna: ['laghu'], virya: 'sheeta', vipaka: 'madhura' },
      sources: [{ document: 'IFCT', page: 45 }],
    },
  ];

  const mockSubstitutions = [
    {
      replacement_food: mockFoods[0],
      quantity: 150.0,
      unit: 'g',
      nutritional_delta: { calories: 5.0, protein_g: 0.2, carbohydrate_g: 1.0, fat_g: -0.1, fiber_g: 0.5 },
      reason: 'Nutritionally equivalent whole grain alternative',
      evidence_sources: [{ document: 'IFCT', page: 45 }],
      requires_dietitian_review: false,
    },
  ];

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    mealPlanRepository._resetMemoryStore();
    jest.restoreAllMocks();

    const pRes = await request(app).post('/api/patients').send({
      name: 'Rohan Mehra',
      age: 40,
      sex: 'male',
      occupation: 'Architect',
    });
    patientId = pRes.body.data.patient.id;

    const aRes = await request(app)
      .post(`/api/patients/${patientId}/assessments`)
      .send({
        assessment_date: '2026-09-25',
        height: 175,
        weight: 76,
        diet_goal: 'weight_loss',
        activity_level: 'sedentary',
        diet_category: 'vegetarian',
        prakriti: 'Pitta-Kapha',
      });
    assessmentId = aRes.body.data.assessment.id;
  });

  describe('GET /api/meal-plan/foods', () => {
    it('should return food database catalog', async () => {
      jest.spyOn(aiService, 'listFoods').mockResolvedValueOnce(mockFoods);

      const res = await request(app).get('/api/meal-plan/foods');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].food_id).toBe('cereal_red_rice');
    });

    it('should return food detail by ID', async () => {
      jest.spyOn(aiService, 'getFoodDetail').mockResolvedValueOnce(mockFoods[0]);

      const res = await request(app).get('/api/meal-plan/foods/cereal_red_rice');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.food_name).toBe('Red Rice (Cooked)');
    });
  });

  describe('POST /api/meal-plan/generate', () => {
    it('should fail with 400 if patient_assessment is missing', async () => {
      const res = await request(app).post('/api/meal-plan/generate').send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/patient_assessment object is required/);
    });

    it('should invoke AI service and return deterministic meal plan', async () => {
      jest.spyOn(aiService, 'generateMealPlan').mockResolvedValueOnce(mockPlan);

      const res = await request(app)
        .post('/api/meal-plan/generate')
        .send({
          patient_assessment: {
            patient_id: patientId,
            assessment_id: assessmentId,
            age: 40,
            sex: 'male',
            height: 175,
            weight: 76,
            diet_goal: 'weight_loss',
            prakriti: 'Pitta-Kapha',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.plan_status).toBe('validated');
      expect(res.body.data.meals.length).toBe(1);
      expect(res.body.data.daily_totals.calories).toBe(1480.0);
    });

    it('should save meal plan when save=true is passed', async () => {
      jest.spyOn(aiService, 'generateMealPlan').mockResolvedValueOnce(mockPlan);

      const res = await request(app)
        .post('/api/meal-plan/generate')
        .send({
          patient_assessment: {
            patient_id: patientId,
            assessment_id: assessmentId,
            age: 40,
            sex: 'male',
          },
          save: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeDefined();

      // Check it can be fetched by ID
      const savedRes = await request(app).get(`/api/meal-plan/${res.body.data.id}`);
      expect(savedRes.status).toBe(200);
      expect(savedRes.body.data.plan_status).toBe('validated');
    });
  });

  describe('POST /api/meal-plan/substitutions', () => {
    it('should fail with 400 if food_id or current_quantity missing', async () => {
      const res = await request(app).post('/api/meal-plan/substitutions').send({ food_id: 'cereal_red_rice' });
      expect(res.status).toBe(400);
    });

    it('should return substitutions from AI service', async () => {
      jest.spyOn(aiService, 'getSubstitutions').mockResolvedValueOnce(mockSubstitutions);

      const res = await request(app)
        .post('/api/meal-plan/substitutions')
        .send({
          food_id: 'cereal_red_rice',
          current_quantity: 150.0,
          patient_assessment: { diet_category: 'vegetarian' },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].replacement_food.food_id).toBe('cereal_red_rice');
    });
  });

  describe('Meal Plan Persistence APIs', () => {
    it('should create and retrieve meal plan', async () => {
      const createRes = await request(app)
        .post('/api/meal-plan')
        .send({
          patient_id: patientId,
          assessment_id: assessmentId,
          plan_status: 'validated',
          nutrition_targets: mockPlan.nutrition_targets,
          meals: mockPlan.meals,
          daily_totals: mockPlan.daily_totals,
          target_comparison: mockPlan.target_comparison,
          validation: mockPlan.validation,
          evidence: mockPlan.evidence,
        });

      expect(createRes.status).toBe(201);
      const planId = createRes.body.data.id;

      const getRes = await request(app).get(`/api/meal-plan/${planId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.patient_id).toBe(patientId);

      const patientPlansRes = await request(app).get(`/api/meal-plan/patient/${patientId}`);
      expect(patientPlansRes.status).toBe(200);
      expect(patientPlansRes.body.count).toBe(1);
    });

    it('should return 404 for non-existent meal plan', async () => {
      const res = await request(app).get('/api/meal-plan/99999');
      expect(res.status).toBe(404);
    });
  });
});
