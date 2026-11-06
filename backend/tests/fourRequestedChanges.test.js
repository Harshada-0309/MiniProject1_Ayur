const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const labDataRepository = require('../src/repositories/labDataRepository');
const fs = require('fs');
const path = require('path');

describe('AyurDiet - Strict Verification of 4 Requested Changes', () => {
  let testPatientId;
  let testAssessmentId;

  beforeEach(async () => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    labDataRepository._resetMemoryStore();

    // Create a base test patient with valid age
    const res = await request(app).post('/api/patients').send({
      name: 'Aarav Patel',
      age: 45,
      sex: 'male',
      occupation: 'Engineer',
    });
    testPatientId = res.body.data.patient.id;

    // Create a base assessment
    const assessRes = await request(app)
      .post(`/api/patients/${testPatientId}/assessments`)
      .send({
        assessment_date: '2026-10-20',
        height: 172.0,
        weight: 70.0,
        diet_goal: 'general_healthy_diet',
        diet_category: 'vegetarian',
        prakriti: 'Vata-Pitta',
        activity_level: 'sedentary',
        exercise_type: 'Walking',
      });
    testAssessmentId = assessRes.body.data.assessment.id;
  });

  // =========================================================================
  // CHANGE 2: MAXIMUM PATIENT AGE OF 105 YEARS INCLUSIVE
  // =========================================================================
  describe('Change 2: Maximum patient age of 105 years inclusive', () => {
    it('accepts age 105 inclusive on patient creation', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Elder Senior',
          age: 105,
          sex: 'female',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.patient.age).toBe(105);
    });

    it('rejects age 106 with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Super Centenarian',
          age: 106,
          sex: 'female',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'age')).toBe(true);
      expect(res.body.errors.find((e) => e.field === 'age').message).toMatch(/0 and 105/i);
    });

    it('rejects age 130 with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Mythical Age',
          age: 130,
          sex: 'male',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'age')).toBe(true);
    });

    it('rejects negative age -5 with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Negative Age',
          age: -5,
          sex: 'male',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'age')).toBe(true);
    });

    it('rejects non-integer age 45.5 with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Decimal Age',
          age: '45.5',
          sex: 'male',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'age')).toBe(true);
    });

    it('rejects age above 105 when updating patient or assessment', async () => {
      const updatePatientRes = await request(app)
        .put(`/api/patients/${testPatientId}`)
        .send({ age: 106 });
      expect(updatePatientRes.status).toBe(400);
      expect(updatePatientRes.body.errors.some((e) => e.field === 'age')).toBe(true);

      const updateAssessmentRes = await request(app)
        .put(`/api/assessments/${testAssessmentId}`)
        .send({ age: 110, diet_goal: 'weight_loss', diet_category: 'vegan', prakriti: 'Kapha' });
      expect(updateAssessmentRes.status).toBe(400);
      expect(updateAssessmentRes.body.errors.some((e) => e.field === 'age')).toBe(true);
    });
  });

  // =========================================================================
  // CHANGE 1: CORRECT INPUT VALIDATION ACROSS ALL 11 ASSESSMENT SECTIONS
  // =========================================================================
  describe('Change 1: Input validation across assessment sections', () => {
    it('specifically rejects numeric-only Exercise Type (e.g. 12345)', async () => {
      const res = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          exercise_type: '12345',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'exercise_type')).toBe(true);
      expect(res.body.errors.find((e) => e.field === 'exercise_type').message).toMatch(
        /descriptive text.*not numbers only/i
      );
    });

    it('accepts valid descriptive Exercise Type such as Walking or Yoga', async () => {
      const resWalking = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          exercise_type: 'Walking',
        });
      expect(resWalking.status).toBe(201);
      expect(resWalking.body.data.assessment.exercise_type).toBe('Walking');

      const resYoga = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          exercise_type: 'Yoga',
        });
      expect(resYoga.status).toBe(201);
      expect(resYoga.body.data.assessment.exercise_type).toBe('Yoga');
    });

    it('rejects invalid text in numerical fields (height, weight, waist, sleep, water, meal_frequency)', async () => {
      // Invalid height
      const resHeight = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: '175cm',
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
        });
      expect(resHeight.status).toBe(400);
      expect(resHeight.body.errors.some((e) => e.field === 'height')).toBe(true);

      // Invalid weight
      const resWeight = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: '70kg',
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
        });
      expect(resWeight.status).toBe(400);
      expect(resWeight.body.errors.some((e) => e.field === 'weight')).toBe(true);

      // Invalid sleep duration
      const resSleep = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          sleep_duration: '8hours',
        });
      expect(resSleep.status).toBe(400);
      expect(resSleep.body.errors.some((e) => e.field === 'sleep_duration')).toBe(true);

      // Invalid water intake
      const resWater = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          water_intake: '2litres',
        });
      expect(resWater.status).toBe(400);
      expect(resWater.body.errors.some((e) => e.field === 'water_intake')).toBe(true);

      // Invalid meal frequency
      const resMf = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          meal_frequency: 'three',
        });
      expect(resMf.status).toBe(400);
      expect(resMf.body.errors.some((e) => e.field === 'meal_frequency')).toBe(true);
    });

    it('rejects numeric-only descriptions in other text fields but preserves text containing numbers', async () => {
      // Goal notes: reject numeric-only '12345', accept 'Target 5kg loss by June'
      const resGoalNotesNum = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          goal_notes: '12345',
        });
      expect(resGoalNotesNum.status).toBe(400);
      expect(resGoalNotesNum.body.errors.some((e) => e.field === 'goal_notes')).toBe(true);

      const resGoalNotesValid = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          goal_notes: 'Target 5kg loss by June',
        });
      expect(resGoalNotesValid.status).toBe(201);

      // Food preferences: reject numeric-only '99999'
      const resFoodPref = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          food_preferences: '99999',
        });
      expect(resFoodPref.status).toBe(400);
      expect(resFoodPref.body.errors.some((e) => e.field === 'food_preferences')).toBe(true);

      // Medical history: reject numeric-only '88888'
      const resMedHist = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          medical_history: '88888',
        });
      expect(resMedHist.status).toBe(400);
      expect(resMedHist.body.errors.some((e) => e.field === 'medical_history')).toBe(true);

      // Medication name: reject numeric-only '12345'
      const resMed = await request(app)
        .post(`/api/patients/${testPatientId}/assessments`)
        .send({
          height: 170,
          weight: 65,
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta',
          medications: [{ medication_name: '12345', dosage: '500mg' }],
        });
      expect(resMed.status).toBe(400);
      expect(resMed.body.errors.some((e) => e.field.includes('medication_name'))).toBe(true);
    });
  });

  // =========================================================================
  // CHANGE 3: SECTION 9 — CLINICAL & LABORATORY DATA
  // =========================================================================
  describe('Change 3: Section 9 — Clinical & Laboratory Data', () => {
    it('A. Validates Test Name, Observed Value, Unit, and Reference Range', async () => {
      // Numeric-only test name rejected
      const resNumTestName = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: '12345',
          value: '100',
        });
      expect(resNumTestName.status).toBe(400);
      expect(resNumTestName.body.errors.some((e) => e.field === 'test_name')).toBe(true);

      // Arbitrary non-numeric text in observed value rejected
      const resArbitraryVal = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: 'Fasting Blood Glucose',
          value: 'jjgh',
        });
      expect(resArbitraryVal.status).toBe(400);
      expect(resArbitraryVal.body.errors.some((e) => e.field === 'value')).toBe(true);

      // Reversed reference range rejected
      const resRevRange = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: 'Fasting Blood Glucose',
          value: '95',
          reference_range: '99 - 70',
        });
      expect(resRevRange.status).toBe(400);
      expect(resRevRange.body.errors.some((e) => e.field === 'reference_range')).toBe(true);
    });

    it('B. Automatically calculates reported status and does not allow manual override', async () => {
      // Value 115 in 70 - 99 should automatically be 'abnormal', even if client sends reported_flag: 'normal'
      const res = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: 'Fasting Blood Glucose',
          value: '115',
          unit: 'mg/dL',
          reference_range: '70 - 99',
          reported_flag: 'normal', // Attempted manual override
        });
      expect(res.status).toBe(201);
      expect(res.body.data.labData.reported_flag).toBe('abnormal');

      // Value 85 in 70 - 99 should automatically be 'normal'
      const resNormal = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: 'Fasting Blood Glucose',
          value: '85',
          unit: 'mg/dL',
          reference_range: '70 - 99',
        });
      expect(resNormal.status).toBe(201);
      expect(resNormal.body.data.labData.reported_flag).toBe('normal');

      // Missing range yields null / undetermined state
      const resNoRange = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: 'Custom Marker',
          value: '50',
          unit: 'U/L',
        });
      expect(resNoRange.status).toBe(201);
      expect(resNoRange.body.data.labData.reported_flag).toBeNull();
    });

    it('C. Deleting attached report preserves the laboratory record', async () => {
      // Create lab record with an attachment
      const createRes = await request(app)
        .post(`/api/assessments/${testAssessmentId}/lab-data`)
        .send({
          test_name: 'Complete Blood Count',
          value: '14.2',
          unit: 'g/dL',
          reference_range: '13.0 - 17.0',
          report_file_metadata: {
            fileName: 'cbc_report.pdf',
            fileSize: 1048576,
            mimeType: 'application/pdf',
          },
        });
      expect(createRes.status).toBe(201);
      const labRecordId = createRes.body.data.labData.id;
      expect(createRes.body.data.labData.report_file_metadata).toBeDefined();

      // Delete the attachment
      const deleteAttachRes = await request(app)
        .delete(`/api/lab-data/${labRecordId}/attachment`);
      expect(deleteAttachRes.status).toBe(200);
      expect(deleteAttachRes.body.data.labData.report_file_metadata).toBeNull();

      // Fetch the lab data list to verify record persists with null attachment
      const fetchListRes = await request(app)
        .get(`/api/assessments/${testAssessmentId}/lab-data`);
      expect(fetchListRes.status).toBe(200);
      const found = fetchListRes.body.data.labData.find((item) => item.id === labRecordId);
      expect(found).toBeDefined();
      expect(found.test_name).toBe('Complete Blood Count');
      expect(found.value).toBe('14.2');
      expect(found.report_file_metadata).toBeNull();
    });
  });

  // =========================================================================
  // CHANGE 4: ABSENCE OF "Assessment #1" FROM ALL PATIENT HEADERS
  // =========================================================================
  describe('Change 4: Remove "Assessment #1" from patient headers', () => {
    it('verifies "Assessment #1" does not appear in frontend header components', () => {
      const assessmentFormPath = path.resolve(__dirname, '../../frontend/src/components/AssessmentForm.jsx');
      const assessmentFormContent = fs.readFileSync(assessmentFormPath, 'utf8');

      // The label "Assessment #1" or "Assessment #" must NOT exist anywhere in AssessmentForm.jsx
      expect(assessmentFormContent).not.toMatch(/Assessment\s*#\s*1/i);
      expect(assessmentFormContent).not.toMatch(/Assessment\s*#\s*\d+/i);
    });
  });
});
