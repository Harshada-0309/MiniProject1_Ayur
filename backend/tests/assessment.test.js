const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const labDataRepository = require('../src/repositories/labDataRepository');

describe('Dietitian Patient Assessment APIs (Phase 2)', () => {
  let patientId;

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    labDataRepository._resetMemoryStore();

    // Create a base test patient
    const res = await request(app).post('/api/patients').send({
      name: 'Rohan Mehra',
      age: 42,
      sex: 'male',
      occupation: 'Architect',
      phone: '+91 91234 56789',
    });
    patientId = res.body.data.patient.id;
  });

  describe('POST /api/patients/:patientId/assessments', () => {
    it('should create a complete 9-section assessment with medications', async () => {
      const payload = {
        assessment_date: '2026-09-25',
        // Section 2: Body Measurements
        height: 175.5,
        weight: 78.2,
        waist_circumference: 88,
        weight_trend: 'gaining',
        // Section 3: Diet Goal
        diet_goal: 'weight_loss',
        target_weight: 70.0,
        goal_notes: 'Gradual weight reduction while balancing Pitta/Kapha',
        // Section 4: Lifestyle
        activity_level: 'sedentary',
        exercise_type: 'Morning brisk walk',
        exercise_frequency: '3 times/week',
        exercise_duration: '30 mins',
        sleep_duration: 6.5,
        sleep_quality: 'fair',
        water_intake: 2.5,
        // Section 5: Dietary Profile
        diet_category: 'vegetarian',
        meal_frequency: 3,
        meal_timings: ['08:30 Breakfast', '13:30 Lunch', '20:30 Dinner'],
        food_preferences: 'Warm cooked khichdi, lentils, ghee, cumin tea',
        foods_disliked: 'Raw cold salads, mushrooms, excessively spicy gravies',
        // Section 6: Safety Restrictions
        food_allergies: ['Peanuts'],
        food_intolerances: ['Lactose'],
        dietary_restrictions: ['Low sodium requested by physician'],
        // Section 7: Medical Information
        existing_conditions: ['Mild Hypertension', 'Acid Reflux'],
        medical_history: 'Borderline high triglycerides diagnosed in 2024',
        symptoms: [
          { symptom: 'Heartburn', frequency: '3-4 times/week', severity: 'moderate' },
          { symptom: 'Post-lunch lethargy', frequency: 'Daily', severity: 'mild' },
        ],
        supplements: 'Triphala churna (5g at bedtime), Vitamin D3 (60k IU weekly)',
        medications: [
          {
            medication_name: 'Telmisartan',
            dosage: '20mg',
            frequency: 'Once daily (morning)',
            purpose: 'Blood pressure regulation',
          },
        ],
        // Section 8: Ayurvedic Information
        prakriti: 'Pitta-Kapha',
        vikriti: 'Aggravated Pitta with mild Kapha stagnation (Ama accumulation)',
        appetite: 'Tikshnagni (Sharp/High)',
        digestion: 'Acidity',
        bowel_habits: 'Regular',
        meal_regularity: 'regular',
        season_ritu: 'Sharad (Autumn)',
        dietitian_observations: 'Excess Ushna (heat) and Tikshna qualities evident. Requires cooling, mildly bitter and sweet tastes.',
      };

      const res = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.assessment).toBeDefined();

      const saved = res.body.data.assessment;
      expect(saved.patient_id).toBe(patientId);
      expect(saved.diet_goal).toBe('weight_loss');
      expect(saved.prakriti).toBe('Pitta-Kapha');
      expect(saved.height).toBe(175.5);
      expect(saved.weight).toBe(78.2);
      expect(saved.medications.length).toBe(1);
      expect(saved.medications[0].medication_name).toBe('Telmisartan');
    });

    it('should reject with 400 when required assessment fields are missing', async () => {
      const res = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          // Missing diet_goal, diet_category, prakriti
          height: 170,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      const fields = res.body.errors.map((e) => e.field);
      expect(fields).toContain('diet_goal');
      expect(fields).toContain('diet_category');
      expect(fields).toContain('prakriti');
    });

    it('should reject with 400 when invalid enum is passed for prakriti', async () => {
      const res = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'InvalidDosha',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'prakriti')).toBe(true);
    });
  });

  describe('GET & PUT /api/assessments/:id', () => {
    it('should retrieve an assessment and allow the dietitian to update it', async () => {
      // 1. Create assessment
      const createRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Vata',
          weight: 60,
          height: 165,
          appetite: 'Vishamagni (Irregular)',
        });

      const assessmentId = createRes.body.data.assessment.id;

      // 2. Fetch assessment
      const getRes = await request(app).get(`/api/assessments/${assessmentId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.assessment.prakriti).toBe('Vata');
      expect(getRes.body.data.assessment.patient.name).toBe('Rohan Mehra');

      // 3. Update assessment (e.g. Dietitian adjusts observations and weight)
      const updateRes = await request(app)
        .put(`/api/assessments/${assessmentId}`)
        .send({
          diet_goal: 'weight_maintenance',
          diet_category: 'vegetarian',
          prakriti: 'Vata',
          weight: 61.5,
          dietitian_observations: 'Vata pacified after 2 weeks of warm soupy meals.',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.assessment.weight).toBe(61.5);
      expect(updateRes.body.data.assessment.diet_goal).toBe('weight_maintenance');
      expect(updateRes.body.data.assessment.dietitian_observations).toContain('Vata pacified');
    });

    it('should update patient details and assessment clinical fields together and persist both', async () => {
      // Create initial assessment
      const createRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          weight: 70,
          height: 175,
        });
      const assessmentId = createRes.body.data.assessment.id;

      // Update assessment with patient name "Vikram Joshi" and new weight
      const updateRes = await request(app)
        .put(`/api/assessments/${assessmentId}`)
        .send({
          name: 'Vikram Joshi',
          occupation: 'Civil Engineer',
          weight: 68.5,
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.status).toBe('success');
      expect(updateRes.body.data.assessment.weight).toBe(68.5);
      expect(updateRes.body.data.assessment.diet_goal).toBe('weight_loss');
      expect(updateRes.body.data.assessment.height).toBe(175); // preserved!
      expect(updateRes.body.data.assessment.patient.name).toBe('Vikram Joshi');
      expect(updateRes.body.data.assessment.patient.occupation).toBe('Civil Engineer');

      // Verify direct patient retrieval also reflects the updated name
      const patientRes = await request(app).get(`/api/patients/${patientId}`);
      expect(patientRes.status).toBe(200);
      expect(patientRes.body.data.patient.name).toBe('Vikram Joshi');
      expect(patientRes.body.data.patient.occupation).toBe('Civil Engineer');
    });

    it('should reject assessment update when patient name contains digits', async () => {
      const createRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Kapha',
        });
      const assessmentId = createRes.body.data.assessment.id;

      const updateRes = await request(app)
        .put(`/api/assessments/${assessmentId}`)
        .send({
          name: 'Vikram123',
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Kapha',
        });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.status).toBe('fail');
      expect(updateRes.body.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should return 404 when assessment ID does not exist', async () => {
      const res = await request(app).get('/api/assessments/99999');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toContain('not found');
    });
  });

  describe('Section 9: Clinical & Laboratory Data APIs', () => {
    it('should store, retrieve, update and delete optional clinical/lab records', async () => {
      // 1. Create assessment
      const createAssessmentRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          diet_goal: 'condition_specific_nutrition',
          diet_category: 'vegetarian',
          prakriti: 'Kapha',
        });
      const assessmentId = createAssessmentRes.body.data.assessment.id;

      // 2. Add clinical lab record (Fasting Blood Sugar)
      const addLabRes = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .send({
          test_name: 'Fasting Blood Sugar (FBS)',
          value: '118',
          unit: 'mg/dL',
          reference_range: '70 - 99',
          test_date: '2026-09-20',
          source_laboratory: 'Metropolis Healthcare',
          reported_flag: 'abnormal',
          report_file_metadata: {
            fileName: 'lab_report_sept2026.pdf',
            fileSize: 1048576,
            mimeType: 'application/pdf',
            uploadDate: '2026-09-25T10:00:00Z',
          },
        });

      expect(addLabRes.status).toBe(201);
      expect(addLabRes.body.data.labData.test_name).toBe('Fasting Blood Sugar (FBS)');
      expect(addLabRes.body.data.labData.reported_flag).toBe('abnormal');
      const labId = addLabRes.body.data.labData.id;

      // 3. List lab records for assessment
      const listLabRes = await request(app).get(`/api/assessments/${assessmentId}/lab-data`);
      expect(listLabRes.status).toBe(200);
      expect(listLabRes.body.results).toBe(1);

      // 4. Update lab record (Dietitian verification / correction)
      const updateLabRes = await request(app)
        .put(`/api/lab-data/${labId}`)
        .send({
          test_name: 'Fasting Blood Sugar (FBS)',
          value: '115',
          reported_flag: 'abnormal',
        });
      expect(updateLabRes.status).toBe(200);
      expect(updateLabRes.body.data.labData.value).toBe('115');

      // 5. Delete lab record
      const deleteLabRes = await request(app).delete(`/api/lab-data/${labId}`);
      expect(deleteLabRes.status).toBe(200);

      // Verify deletion
      const listAfterDelete = await request(app).get(`/api/assessments/${assessmentId}/lab-data`);
      expect(listAfterDelete.body.results).toBe(0);
    });

    it('should fail with 400 when required lab fields are missing', async () => {
      const createAssessmentRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Tridosha',
        });
      const assessmentId = createAssessmentRes.body.data.assessment.id;

      const badRes = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .send({
          // Missing test_name and value
          unit: 'mg/dL',
        });

      expect(badRes.status).toBe(400);
      expect(badRes.body.errors.some((e) => e.field === 'test_name')).toBe(true);
      expect(badRes.body.errors.some((e) => e.field === 'value')).toBe(true);
    });
  });
});
