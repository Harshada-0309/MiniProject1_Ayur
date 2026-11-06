const request = require('supertest');
const app = require('../src/app');
const dietPlanRepository = require('../src/repositories/dietPlanRepository');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const aiService = require('../src/services/aiService');

describe('Final Diet Prescription PDF Export & Printing Workflow', () => {
  const samplePlan = {
    plan_id: 'dp_approved_test123',
    patient_id: 1,
    assessment_id: 1,
    title: '7-Day Personalized Ayurvedic Diet Plan',
    status: 'draft',
    patient_summary: 'Adult male, 45 yrs, Pitta-Kapha constitution with balanced agni.',
    clinical_rationale: 'Calibrated daily energy of ~2000 kcal with balanced macronutrients.',
    ayurvedic_dietary_principles: [
      'Ahara Vidhi: Consume warm, freshly cooked meals in a calm environment.',
      'Shad Rasa: Balance all six fundamental tastes.',
    ],
    dosha_guidelines: {
      pitta: 'Favor cooling and non-irritating foods.',
    },
    days: [
      {
        day_number: 1,
        day_name: 'Day 1 (Monday)',
        theme: 'Restorative Agni Rekindling',
        daily_totals: { calories: 1980, protein_g: 65, carbohydrate_g: 260, fat_g: 50 },
        meals: [
          {
            meal_type: 'breakfast',
            timing: '08:00 AM',
            totals: { calories: 450, protein_g: 15 },
            foods: [
              { food_name: 'Rolled Oats Porridge', quantity: 60, unit: 'g', calories: 230 }
            ]
          }
        ]
      }
    ],
    general_instructions: ['Drink warm water regularly', 'Conclude dinner 3 hours prior to sleep'],
    validation_results: { passed: true, errors: [], warnings: [] },
    is_approved: false,
  };

  beforeEach(async () => {
    dietPlanRepository._resetMemoryStore();
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    jest.restoreAllMocks();

    await patientRepository.create({
      id: 1,
      name: 'Arun Kumar',
      patient_code: 'PAT-2026-0001',
      age: 45,
      sex: 'male',
      dietitian_id: 1,
    });
  });

  it('1. should reject PDF export when plan is unapproved', async () => {
    const saved = await dietPlanRepository.create({
      ...samplePlan,
      is_approved: false,
      status: 'draft',
    });

    const res = await request(app).get(`/api/diet-plan/${saved.id}/pdf`);
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toContain('formally approved');
  });

  it('2. should export valid PDF when plan is formally approved', async () => {
    const saved = await dietPlanRepository.create({
      ...samplePlan,
      is_approved: true,
      status: 'approved',
      approved_by: 'Dr. Vaidya',
      approved_at: new Date().toISOString(),
    });

    const mockPdfBuffer = Buffer.from('%PDF-1.4 simulated pdf binary content %%EOF');
    jest.spyOn(aiService, 'exportDietPlanPdf').mockResolvedValue(mockPdfBuffer);

    const res = await request(app).get(`/api/diet-plan/${saved.id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toContain('attachment; filename="AyurDiet_Prescription_PAT-2026-0001_');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('3. should revoke approval when dietitian edits plan portions or notes', async () => {
    const saved = await dietPlanRepository.create({
      ...samplePlan,
      is_approved: true,
      status: 'approved',
      approved_by: 'Dr. Vaidya',
      approved_at: new Date().toISOString(),
    });

    // Dietitian edits the plan
    const updateRes = await request(app)
      .put(`/api/diet-plan/${saved.id}`)
      .send({
        dietitian_notes: 'Adjusted portions for follow-up week.',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.is_approved).toBe(false);
    expect(updateRes.body.data.status).toBe('needs_review');

    // Attempting to export PDF now must fail with 400
    const pdfRes = await request(app).get(`/api/diet-plan/${saved.id}/pdf`);
    expect(pdfRes.status).toBe(400);
    expect(pdfRes.body.message).toContain('formally approved');
  });

  it('4. should allow PDF export again after re-approval', async () => {
    const saved = await dietPlanRepository.create(samplePlan);

    // Initial approve
    await request(app)
      .post(`/api/diet-plan/${saved.id}/approve`)
      .send({ approved_by: 'Dr. Vaidya' });

    // Mock PDF generation
    const mockPdfBuffer = Buffer.from('%PDF-1.4 verified pdf bytes %%EOF');
    jest.spyOn(aiService, 'exportDietPlanPdf').mockResolvedValue(mockPdfBuffer);

    const pdfRes = await request(app).get(`/api/diet-plan/${saved.id}/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.header['content-type']).toBe('application/pdf');
  });

  it('5. should enforce patient isolation on PDF export', async () => {
    // Create patient under different dietitian
    await patientRepository.create({
      id: 99,
      name: 'Isolated Patient',
      dietitian_id: 2,
    });

    const planForOtherPatient = await dietPlanRepository.create({
      ...samplePlan,
      patient_id: 99,
      is_approved: true,
      status: 'approved',
    });

    // Request as dietitian 1 (default test dietitian)
    const res = await request(app).get(`/api/diet-plan/${planForOtherPatient.id}/pdf`);
    expect(res.status).toBe(404);
  });
});

