const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const labDataRepository = require('../src/repositories/labDataRepository');
const mealPlanRepository = require('../src/repositories/mealPlanRepository');
const dietPlanRepository = require('../src/repositories/dietPlanRepository');
const { generateToken } = require('../src/services/authService');

describe('Security Integration Suite: Account-Level Patient Data Isolation', () => {
  let doctorAToken;
  let doctorBToken;

  const validAssessment = {
    assessment_date: '2026-10-21',
    diet_goal: 'weight_loss',
    diet_category: 'vegetarian',
    prakriti: 'Pitta-Kapha',
    height: 172,
    weight: 78,
  };

  beforeEach(() => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
    labDataRepository._resetMemoryStore();
    mealPlanRepository._resetMemoryStore();
    dietPlanRepository._resetMemoryStore();

    // Fresh tokens for each test
    doctorAToken = generateToken({
      id: 1,
      dietitian_code: 'DIET-2026-001',
      name: 'Dr. Vaidya',
      email: 'vaidya@ayurdiet.clinic',
      role: 'Chief Clinical Dietitian',
    });

    doctorBToken = generateToken({
      id: 2,
      dietitian_code: 'DIET-2026-002',
      name: 'Dr. Rajesh Sharma',
      email: 'rajesh.sharma@ayurdiet.clinic',
      role: 'Senior Ayurvedic Physician',
    });
  });

  // -------------------------------------------------------------
  // Test 1 — Patient Ownership
  // -------------------------------------------------------------
  describe('Test 1 — Patient ownership', () => {
    it('Doctor A creates a patient; Doctor A can retrieve the patient and Doctor B cannot', async () => {
      // Doctor A registers patient Rahul Sharma
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          name: 'Rahul Sharma',
          age: 35,
          sex: 'male',
          occupation: 'Financial Analyst',
          phone: '+91 98765 11111',
          email: 'rahul.sharma@example.com',
        });

      expect(createRes.status).toBe(201);
      const patientId = createRes.body.data.patient.id;
      expect(createRes.body.data.patient.dietitian_id).toBe(1);

      // Doctor A retrieves the patient
      const docARes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(docARes.status).toBe(200);
      expect(docARes.body.data.patient.name).toBe('Rahul Sharma');

      // Doctor B attempts to retrieve the patient -> Denied (404)
      const docBRes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(docBRes.status).toBe(404);
      expect(docBRes.body.message).toMatch(/not found/i);
    });
  });

  // -------------------------------------------------------------
  // Test 2 — Patient List Isolation
  // -------------------------------------------------------------
  describe('Test 2 — Patient list isolation', () => {
    it('Each doctor sees only their own patients in the patient list', async () => {
      // Doctor A creates 2 patients
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Aarav Patel', age: 29, sex: 'female' });
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Sunita Menon', age: 41, sex: 'male' });

      // Doctor B creates 1 patient
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ name: 'Vikramaditya Rao', age: 50, sex: 'female' });

      // Doctor A lists patients
      const listA = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(listA.status).toBe(200);
      expect(listA.body.results).toBe(2);
      expect(listA.body.data.patients.map((p) => p.name)).toEqual(
        expect.arrayContaining(['Aarav Patel', 'Sunita Menon'])
      );
      expect(listA.body.data.patients.some((p) => p.name === 'Vikramaditya Rao')).toBe(false);

      // Doctor B lists patients
      const listB = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(listB.status).toBe(200);
      expect(listB.body.results).toBe(1);
      expect(listB.body.data.patients[0].name).toBe('Vikramaditya Rao');
      expect(listB.body.data.patients.some((p) => p.name === 'Aarav Patel')).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Test 3 — Direct Patient Access
  // -------------------------------------------------------------
  describe('Test 3 — Direct patient access', () => {
    it('Doctor B attempts to fetch Doctor A patient by ID; access is denied with 404', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Pooja Verma', age: 32, sex: 'female' });

      const patientId = createRes.body.data.patient.id;

      const directRes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(directRes.status).toBe(404);
      expect(directRes.body.message).toMatch(`Patient with ID ${patientId} not found`);
    });
  });

  // -------------------------------------------------------------
  // Test 4 — Unauthorized Updates
  // -------------------------------------------------------------
  describe('Test 4 — Unauthorized updates', () => {
    it('Doctor B attempts to modify Doctor A patient; operation is denied and data is unchanged', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          name: 'Original Patel',
          age: 40,
          sex: 'male',
          occupation: 'Civil Engineer',
          phone: '+91 99999 11111',
        });

      const patientId = createRes.body.data.patient.id;

      // Doctor B attempts to update the patient
      const updateAttempt = await request(app)
        .put(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          name: 'Malicious Change',
          occupation: 'Malicious Occupation',
        });

      expect(updateAttempt.status).toBe(404);

      // Verify the patient record in database remains untouched
      const verifyRes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.patient.name).toBe('Original Patel');
      expect(verifyRes.body.data.patient.occupation).toBe('Civil Engineer');
    });
  });

  // -------------------------------------------------------------
  // Test 5 — Unauthorized Deletion
  // -------------------------------------------------------------
  describe('Test 5 — Unauthorized deletion', () => {
    it('Doctor B attempts to delete Doctor A patient; operation is denied and patient remains intact', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Protected Patient', age: 28, sex: 'female' });

      const patientId = createRes.body.data.patient.id;

      // Doctor B attempts to delete
      const deleteAttempt = await request(app)
        .delete(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(deleteAttempt.status).toBe(404);

      // Verify patient still exists and is accessible to Doctor A
      const verifyRes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.patient.name).toBe('Protected Patient');
    });
  });

  // -------------------------------------------------------------
  // Test 6 — Assessment Isolation
  // -------------------------------------------------------------
  describe('Test 6 — Assessment isolation', () => {
    it('Doctor B attempts to read or update Doctor A assessment directly; access is denied with 404', async () => {
      // 1. Doctor A creates a patient
      const patientRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Clinical Subject', age: 44, sex: 'male' });
      const patientId = patientRes.body.data.patient.id;

      // 2. Doctor A creates an assessment
      const assessRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(validAssessment);

      expect(assessRes.status).toBe(201);
      const assessmentId = assessRes.body.data.assessment.id;

      // 3. Doctor B attempts to fetch assessment directly by ID
      const directGet = await request(app)
        .get(`/api/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(directGet.status).toBe(404);

      // 4. Doctor B attempts to update Doctor A assessment
      const directUpdate = await request(app)
        .put(`/api/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          ...validAssessment,
          weight: 99,
          diet_goal: 'weight_gain',
        });

      expect(directUpdate.status).toBe(404);

      // 5. Doctor A confirms assessment data is unaffected
      const docAVerify = await request(app)
        .get(`/api/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(docAVerify.status).toBe(200);
      expect(docAVerify.body.data.assessment.weight).toBe(78);
      expect(docAVerify.body.data.assessment.diet_goal).toBe('weight_loss');
    });
  });

  // -------------------------------------------------------------
  // Test 7 — Related Records Access Control
  // -------------------------------------------------------------
  describe('Test 7 — Related records', () => {
    it('Doctor B cannot access Doctor A nested assessments, lab data, meal plans, diet plans, or calculations', async () => {
      // Doctor A setup
      const pRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Ananya Sen', age: 36, sex: 'female' });
      const patientId = pRes.body.data.patient.id;

      const aRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(validAssessment);
      expect(aRes.status).toBe(201);
      const assessmentId = aRes.body.data.assessment.id;

      // Lab record created for Doctor A assessment
      const labRes = await request(app)
        .post(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          test_name: 'Fasting Lipid Panel',
          value: '190',
          unit: 'mg/dL',
          test_date: '2026-10-21',
        });
      expect(labRes.status).toBe(201);
      const labId = labRes.body.data.labData.id;

      // Meal plan saved for Doctor A patient
      const mealRes = await request(app)
        .post('/api/meal-plan')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patient_id: patientId,
          assessment_id: assessmentId,
          plan_status: 'validated',
          meals: [],
          nutrition_targets: { energy: { target_energy_kcal_day: 1800 } },
        });
      expect(mealRes.status).toBe(201);
      const mealPlanId = mealRes.body.data.id;

      // Diet plan saved for Doctor A patient
      const dietRes = await request(app)
        .post('/api/diet-plan')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patient_id: patientId,
          assessment_id: assessmentId,
          plan_id: 'dp_docA_secret',
          title: 'Doctor A Confidential Diet',
          status: 'draft',
          days: [],
        });
      expect(dietRes.status).toBe(201);
      const dietPlanId = dietRes.body.data.id;

      // 1. Doctor B tries nested assessment list for Doctor A patient -> 404
      const nestedAssess = await request(app)
        .get(`/api/patients/${patientId}/assessments`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(nestedAssess.status).toBe(404);

      // 2. Doctor B tries to create assessment for Doctor A patient -> 404
      const unauthCreateAssess = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send(validAssessment);
      expect(unauthCreateAssess.status).toBe(404);

      // 3. Doctor B tries to read lab data for Doctor A assessment -> 404
      const labGet = await request(app)
        .get(`/api/assessments/${assessmentId}/lab-data`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(labGet.status).toBe(404);

      // 4. Doctor B tries to update lab record -> 404
      const labUpdate = await request(app)
        .put(`/api/lab-data/${labId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ test_name: 'Fasting Lipid Panel', value: '999' });
      expect(labUpdate.status).toBe(404);

      // 5. Doctor B tries to delete lab record -> 404
      const labDelete = await request(app)
        .delete(`/api/lab-data/${labId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(labDelete.status).toBe(404);

      // 6. Doctor B tries to retrieve meal plans by patient ID -> 404
      const mealByPat = await request(app)
        .get(`/api/meal-plan/patient/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(mealByPat.status).toBe(404);

      // 7. Doctor B tries to retrieve meal plan by ID -> 404
      const mealById = await request(app)
        .get(`/api/meal-plan/${mealPlanId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(mealById.status).toBe(404);

      // 8. Doctor B tries to save meal plan for Doctor A patient -> 404
      const unauthMealSave = await request(app)
        .post('/api/meal-plan')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ patient_id: patientId, meals: [] });
      expect(unauthMealSave.status).toBe(404);

      // 9. Doctor B tries to retrieve diet plans by patient ID -> 404
      const dietByPat = await request(app)
        .get(`/api/diet-plan/patient/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(dietByPat.status).toBe(404);

      // 10. Doctor B tries to retrieve diet plan by ID -> 404
      const dietById = await request(app)
        .get(`/api/diet-plan/${dietPlanId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(dietById.status).toBe(404);

      // 11. Doctor B tries to update diet plan -> 404
      const dietUpdate = await request(app)
        .put(`/api/diet-plan/${dietPlanId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ title: 'Hacked Title' });
      expect(dietUpdate.status).toBe(404);

      // 12. Doctor B tries to approve diet plan -> 404
      const dietApprove = await request(app)
        .post(`/api/diet-plan/${dietPlanId}/approve`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ approved_by: 'dr_sharma' });
      expect(dietApprove.status).toBe(404);

      // 13. Doctor B tries to calculate nutrition targets for Doctor A assessment -> 404
      const unauthCalc = await request(app)
        .get(`/api/nutrition/assessments/${assessmentId}/calculate`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(unauthCalc.status).toBe(404);
    });
  });

  // -------------------------------------------------------------
  // Test 8 — Spoofed Ownership
  // -------------------------------------------------------------
  describe('Test 8 — Spoofed ownership', () => {
    it('Doctor B attempts to submit Doctor A ID in request payload; ownership cannot be forged', async () => {
      // Doctor B registers a patient with dietitian_id: 1 in body
      const spoofRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          name: 'Spoof Test Subject',
          age: 26,
          sex: 'male',
          dietitian_id: 1, // Maliciously forged dietitian ID targeting Doctor A
        });

      expect(spoofRes.status).toBe(201);
      const createdPatient = spoofRes.body.data.patient;

      // The backend MUST override and assign strictly to authenticated Doctor B (ID: 2)
      expect(createdPatient.dietitian_id).toBe(2);

      // Doctor A must NOT see this patient
      const docAGet = await request(app)
        .get(`/api/patients/${createdPatient.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(docAGet.status).toBe(404);

      // Doctor B MUST see this patient
      const docBGet = await request(app)
        .get(`/api/patients/${createdPatient.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(docBGet.status).toBe(200);

      // Doctor B attempts to transfer patient to Doctor A via PUT payload
      const transferRes = await request(app)
        .put(`/api/patients/${createdPatient.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          dietitian_id: 1,
        });

      expect(transferRes.status).toBe(200);
      expect(transferRes.body.data.patient.dietitian_id).toBe(2);
    });
  });

  // -------------------------------------------------------------
  // Test 9 — Dashboard and Search Isolation
  // -------------------------------------------------------------
  describe('Test 9 — Dashboard and search isolation', () => {
    it('Patient search and list queries return only authorized records for each doctor', async () => {
      // Create patients
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Rahul Sharma', age: 34, sex: 'male' });

      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ name: 'Rahul Gupta', age: 45, sex: 'male' });

      // Doctor A searches "Rahul"
      const searchA = await request(app)
        .get('/api/patients?search=Rahul')
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(searchA.status).toBe(200);
      expect(searchA.body.results).toBe(1);
      expect(searchA.body.data.patients[0].name).toBe('Rahul Sharma');

      // Doctor B searches "Rahul"
      const searchB = await request(app)
        .get('/api/patients?search=Rahul')
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(searchB.status).toBe(200);
      expect(searchB.body.results).toBe(1);
      expect(searchB.body.data.patients[0].name).toBe('Rahul Gupta');

      // Doctor B searches specifically for Doctor A patient "Rahul Sharma"
      const searchHidden = await request(app)
        .get('/api/patients?search=Sharma')
        .set('Authorization', `Bearer ${doctorBToken}`);

      expect(searchHidden.status).toBe(200);
      expect(searchHidden.body.results).toBe(0);
      expect(searchHidden.body.data.patients).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Test 10 — Persistence Across Sessions
  // -------------------------------------------------------------
  describe('Test 10 — Persistence', () => {
    it('Patient ownership remains intact after session logout and re-login', async () => {
      // Doctor A creates a patient
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ name: 'Persistent Subject', age: 52, sex: 'female' });
      const patientId = createRes.body.data.patient.id;

      // Doctor A logs out (revokes session token)
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(logoutRes.status).toBe(200);

      // Attempting to use the revoked token fails with 401
      const expiredAttempt = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(expiredAttempt.status).toBe(401);

      // Doctor A logs in again (new fresh token)
      const freshTokenA = generateToken({
        id: 1,
        dietitian_code: 'DIET-2026-001',
        name: 'Dr. Vaidya',
        email: 'vaidya@ayurdiet.clinic',
        role: 'Chief Clinical Dietitian',
      });

      // Doctor A accesses the patient with the new session
      const reaccessRes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${freshTokenA}`);

      expect(reaccessRes.status).toBe(200);
      expect(reaccessRes.body.data.patient.name).toBe('Persistent Subject');
      expect(reaccessRes.body.data.patient.dietitian_id).toBe(1);

      // Doctor B cannot access this patient
      const docBCheck = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(docBCheck.status).toBe(404);
    });
  });

  // -------------------------------------------------------------
  // Test 11 — Existing Data Preservation & Unverified Ownership
  // -------------------------------------------------------------
  describe('Test 11 — Existing data preservation', () => {
    it('Preserves verified ownership and restricts unassigned records from global access', async () => {
      // Simulate historical seed patients
      const seedPatientDocA = await patientRepository.create({
        patient_code: 'PAT-2026-0001',
        name: 'Priya Sharma',
        age: 38,
        sex: 'female',
        dietitian_id: 1,
      });

      const seedPatientDocB = await patientRepository.create({
        patient_code: 'PAT-2026-0002',
        name: 'Vikram Joshi',
        age: 46,
        sex: 'male',
        dietitian_id: 2,
      });

      // Doctor A can access Patient 1 but NOT Patient 2
      const aGet1 = await request(app)
        .get(`/api/patients/${seedPatientDocA.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(aGet1.status).toBe(200);
      expect(aGet1.body.data.patient.name).toBe('Priya Sharma');

      const aGet2 = await request(app)
        .get(`/api/patients/${seedPatientDocB.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(aGet2.status).toBe(404);

      // Doctor B can access Patient 2 but NOT Patient 1
      const bGet2 = await request(app)
        .get(`/api/patients/${seedPatientDocB.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(bGet2.status).toBe(200);
      expect(bGet2.body.data.patient.name).toBe('Vikram Joshi');

      const bGet1 = await request(app)
        .get(`/api/patients/${seedPatientDocA.id}`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(bGet1.status).toBe(404);
    });
  });

  // -------------------------------------------------------------
  // Test 12 — Regression: Authorized Workflows Still Work
  // -------------------------------------------------------------
  describe('Test 12 — Regression', () => {
    it('Authorized doctor can create, update, assess, and delete their own patient', async () => {
      // 1. Create patient
      const createRes = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          name: 'Meera Nambiar',
          age: 33,
          sex: 'female',
          occupation: 'Lecturer',
          phone: '+91 94470 12345',
          email: 'meera@example.com',
        });

      expect(createRes.status).toBe(201);
      const patientId = createRes.body.data.patient.id;

      // 2. Update patient
      const updateRes = await request(app)
        .put(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          occupation: 'Senior Lecturer Researcher',
          phone: '+91 94470 99999',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.patient.occupation).toBe('Senior Lecturer Researcher');

      // 3. Create assessment
      const assessRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send(validAssessment);

      expect(assessRes.status).toBe(201);
      const assessmentId = assessRes.body.data.assessment.id;

      // 4. Update assessment
      const updateAssessRes = await request(app)
        .put(`/api/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          ...validAssessment,
          diet_goal: 'weight_gain',
          weight: 63,
        });

      expect(updateAssessRes.status).toBe(200);
      expect(updateAssessRes.body.data.assessment.diet_goal).toBe('weight_gain');

      // 5. Delete patient
      const deleteRes = await request(app)
        .delete(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);

      // Verify deletion
      const checkRes = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
