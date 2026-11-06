const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');

describe('AyurDiet Assessment Update & Validation Workflow Tests (Tests 1-7)', () => {
  let patientId;
  let assessmentId;

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();

    // Setup an initial patient and assessment (e.g. Vikram Joshi / PAT-2026-0002)
    const patientRes = await request(app)
      .post('/api/patients')
      .send({
        name: 'Vikram Old',
        age: 46,
        sex: 'male',
        occupation: 'Junior Engineer',
        phone: '+91 98765 00002',
        patient_code: 'PAT-2026-0002',
      });
    patientId = patientRes.body.data.patient.id;

    const assessmentRes = await request(app)
      .post(`/api/patients/${patientId}/assessments`)
      .send({
        assessment_date: '2026-09-16',
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
        height: 172,
        weight: 74,
        waist_circumference: 88,
        activity_level: 'sedentary',
        sleep_duration: 7,
        water_intake: 2.5,
        dietitian_observations: 'Initial baseline consultation.',
      });
    assessmentId = assessmentRes.body.data.assessment.id;
  });

  // Test 1: Valid name and successful update
  test('Test 1: Valid name and successful update saves both patient name and assessment field', async () => {
    const updateRes = await request(app)
      .put(`/api/assessments/${assessmentId}`)
      .send({
        name: 'Vikram Joshi',
        occupation: 'Civil Engineer',
        weight: 71.5,
        diet_goal: 'weight_loss',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
        dietitian_observations: 'Updated consultation - weight loss initiated.',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('success');
    expect(updateRes.body.data.assessment.weight).toBe(71.5);
    expect(updateRes.body.data.assessment.diet_goal).toBe('weight_loss');
    expect(updateRes.body.data.assessment.patient.name).toBe('Vikram Joshi');
    expect(updateRes.body.data.assessment.patient.occupation).toBe('Civil Engineer');

    // Confirm that the server persistent store has both values
    const fetchPatient = await request(app).get(`/api/patients/${patientId}`);
    expect(fetchPatient.status).toBe(200);
    expect(fetchPatient.body.data.patient.name).toBe('Vikram Joshi');
    expect(fetchPatient.body.data.patient.occupation).toBe('Civil Engineer');

    const fetchAssessment = await request(app).get(`/api/assessments/${assessmentId}`);
    expect(fetchAssessment.status).toBe(200);
    expect(fetchAssessment.body.data.assessment.weight).toBe(71.5);
    expect(fetchAssessment.body.data.assessment.patient.name).toBe('Vikram Joshi');
  });

  // Test 2: Name containing digits
  test('Test 2: Name containing digits (Vikram123) is rejected with 400 and does not update', async () => {
    const updateRes = await request(app)
      .put(`/api/assessments/${assessmentId}`)
      .send({
        name: 'Vikram123',
        weight: 72,
        diet_goal: 'weight_loss',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.status).toBe('fail');
    const nameErr = updateRes.body.errors.find((e) => e.field === 'name');
    expect(nameErr).toBeDefined();
    expect(nameErr.message).toMatch(/cannot contain numerical digits/i);

    // Verify patient was NOT modified
    const fetchPatient = await request(app).get(`/api/patients/${patientId}`);
    expect(fetchPatient.body.data.patient.name).toBe('Vikram Old');
  });

  // Test 3: Name containing spaces and hyphens
  test('Test 3: Name containing spaces and hyphens (Mary-Jane Smith) passes validation', async () => {
    const updateRes = await request(app)
      .put(`/api/assessments/${assessmentId}`)
      .send({
        name: 'Mary-Jane Smith',
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.assessment.patient.name).toBe('Mary-Jane Smith');
  });

  // Test 4: Empty name
  test('Test 4: Empty name is rejected with 400', async () => {
    const updateRes = await request(app)
      .put(`/api/assessments/${assessmentId}`)
      .send({
        name: '   ',
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.status).toBe('fail');
    expect(updateRes.body.errors.some((e) => e.field === 'name')).toBe(true);
  });

  // Test 5: Numeric fields
  test('Test 5: Legitimate numeric values can still be entered in age, height, weight, waist, phone', async () => {
    const updatePatientRes = await request(app)
      .put(`/api/patients/${patientId}`)
      .send({
        age: 47,
        phone: '+91 91234 56789',
      });
    expect(updatePatientRes.status).toBe(200);
    expect(updatePatientRes.body.data.patient.age).toBe(47);
    expect(updatePatientRes.body.data.patient.phone).toBe('+91 91234 56789');

    const updateAssessmentRes = await request(app)
      .put(`/api/assessments/${assessmentId}`)
      .send({
        height: 175.5,
        weight: 73.2,
        waist_circumference: 86.5,
        sleep_duration: 8,
        water_intake: 3.0,
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
      });
    expect(updateAssessmentRes.status).toBe(200);
    expect(updateAssessmentRes.body.data.assessment.height).toBe(175.5);
    expect(updateAssessmentRes.body.data.assessment.weight).toBe(73.2);
    expect(updateAssessmentRes.body.data.assessment.waist_circumference).toBe(86.5);
  });

  // Test 6: Failed update
  test('Test 6: Genuine API failure (e.g. non-existent assessment ID) returns 404 error and does not falsely claim success', async () => {
    const updateRes = await request(app)
      .put('/api/assessments/999999')
      .send({
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
      });

    expect(updateRes.status).toBe(404);
    expect(updateRes.body.status).toBe('fail');
    expect(updateRes.body.message).toMatch(/not found/i);
  });

  // Test 7: Assessment data preservation
  test('Test 7: Updating one field preserves all other assessment sections and patient history', async () => {
    // Initial height is 172, waist is 88, sleep is 7, water is 2.5
    const updateRes = await request(app)
      .put(`/api/assessments/${assessmentId}`)
      .send({
        weight: 71.0,
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.assessment.weight).toBe(71.0);
    // Preserved fields:
    expect(updateRes.body.data.assessment.height).toBe(172);
    expect(updateRes.body.data.assessment.waist_circumference).toBe(88);
    expect(updateRes.body.data.assessment.sleep_duration).toBe(7);
    expect(updateRes.body.data.assessment.water_intake).toBe(2.5);
    expect(updateRes.body.data.assessment.assessment_date).toBe('2026-09-16');
  });
});
