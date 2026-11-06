const request = require('supertest');
const app = require('../src/app');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');

describe('Dietitian Patient Management APIs (Phase 2)', () => {
  beforeEach(() => {
    patientRepository._resetMemoryStore();
    assessmentRepository._resetMemoryStore();
  });

  describe('POST /api/patients', () => {
    it('should create a patient with valid data and auto-generated patient code', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Aarav Sharma',
          age: 34,
          sex: 'male',
          occupation: 'Software Engineer',
          phone: '+91 98765 43210',
          email: 'aarav@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.patient).toBeDefined();
      expect(res.body.data.patient.id).toBeDefined();
      expect(res.body.data.patient.name).toBe('Aarav Sharma');
      expect(res.body.data.patient.patient_code).toMatch(/^PAT-\d{4}-\d{4}$/);
    });

    it('should fail with 400 when name is missing or too short', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'A',
          age: 30,
          sex: 'male',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should fail with 400 when age is invalid', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Priya Patel',
          age: -5,
          sex: 'female',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'age')).toBe(true);
    });

    it('should fail with 400 when sex is invalid', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send({
          name: 'Priya Patel',
          age: 28,
          sex: 'unknown-sex',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === 'sex')).toBe(true);
    });

    it('should reject names containing digits (e.g. Vikram123, 12345, Rahul 7)', async () => {
      const invalidNames = ['Vikram123', '12345', 'Rahul 7'];
      for (const invalidName of invalidNames) {
        const res = await request(app)
          .post('/api/patients')
          .send({
            name: invalidName,
            age: 30,
            sex: 'male',
          });
        expect(res.status).toBe(400);
        expect(res.body.status).toBe('fail');
        const nameErr = res.body.errors.find((e) => e.field === 'name');
        expect(nameErr).toBeDefined();
        expect(nameErr.message).toMatch(/cannot contain numerical digits/i);
      }
    });

    it('should accept legitimate names with spaces, hyphens, and apostrophes', async () => {
      const validNames = ['Mary-Jane Smith', 'O\'Connor', 'Vikram Joshi'];
      for (const validName of validNames) {
        const res = await request(app)
          .post('/api/patients')
          .send({
            name: validName,
            age: 30,
            sex: 'male',
          });
        expect(res.status).toBe(201);
        expect(res.body.data.patient.name).toBe(validName);
      }
    });
  });

  describe('GET /api/patients', () => {
    it('should list patients and support search query', async () => {
      await request(app).post('/api/patients').send({ name: 'Sunita Rao', age: 45, sex: 'female' });
      await request(app).post('/api/patients').send({ name: 'Vikram Singh', age: 52, sex: 'male' });

      // List all
      const listRes = await request(app).get('/api/patients');
      expect(listRes.status).toBe(200);
      expect(listRes.body.results).toBe(2);

      // Search by name
      const searchRes = await request(app).get('/api/patients?search=Vikram');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.results).toBe(1);
      expect(searchRes.body.data.patients[0].name).toBe('Vikram Singh');
    });
  });

  describe('GET & PUT /api/patients/:id', () => {
    it('should get patient by id and update details', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .send({ name: 'Kavita Joshi', age: 39, sex: 'female', occupation: 'Teacher' });
      const patientId = createRes.body.data.patient.id;

      // Get
      const getRes = await request(app).get(`/api/patients/${patientId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.patient.name).toBe('Kavita Joshi');

      // Update
      const updateRes = await request(app)
        .put(`/api/patients/${patientId}`)
        .send({ occupation: 'Senior Professor', phone: '+91 99999 88888' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.patient.occupation).toBe('Senior Professor');
      expect(updateRes.body.data.patient.phone).toBe('+91 99999 88888');
    });

    it('should reject updating patient name with digits', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .send({ name: 'Vikram Joshi', age: 46, sex: 'male' });
      const patientId = createRes.body.data.patient.id;

      const updateRes = await request(app)
        .put(`/api/patients/${patientId}`)
        .send({ name: 'Vikram123' });
      expect(updateRes.status).toBe(400);
      expect(updateRes.body.status).toBe('fail');
      expect(updateRes.body.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('should successfully update patient name with valid human name', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .send({ name: 'Vikram Old', age: 46, sex: 'male' });
      const patientId = createRes.body.data.patient.id;

      const updateRes = await request(app)
        .put(`/api/patients/${patientId}`)
        .send({ name: 'Vikram Joshi', occupation: 'Civil Engineer' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.patient.name).toBe('Vikram Joshi');
      expect(updateRes.body.data.patient.occupation).toBe('Civil Engineer');
    });

    it('should return 404 for non-existent patient id', async () => {
      const res = await request(app).get('/api/patients/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/patients/:id', () => {
    it('should return 400 for invalid patient ID (non-numeric or negative)', async () => {
      const badIdRes = await request(app).delete('/api/patients/invalid-id');
      expect(badIdRes.status).toBe(400);
      expect(badIdRes.body.status).toBe('fail');

      const negIdRes = await request(app).delete('/api/patients/-5');
      expect(negIdRes.status).toBe(400);
      expect(negIdRes.body.status).toBe('fail');
    });

    it('should return 404 when deleting a non-existent patient', async () => {
      const res = await request(app).delete('/api/patients/99999');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('fail');
    });

    it('should successfully delete an existing patient and return 200 with metadata', async () => {
      // 1. Create patient
      const createRes = await request(app)
        .post('/api/patients')
        .send({ name: 'Meera Nambiar', age: 31, sex: 'female', occupation: 'Architect' });
      expect(createRes.status).toBe(201);
      const patientId = createRes.body.data.patient.id;

      // 2. Delete patient
      const deleteRes = await request(app).delete(`/api/patients/${patientId}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('success');
      expect(deleteRes.body.message).toMatch(/deleted successfully/i);
      expect(deleteRes.body.data.id).toBe(patientId);

      // 3. Verify patient is no longer found
      const getRes = await request(app).get(`/api/patients/${patientId}`);
      expect(getRes.status).toBe(404);

      // 4. Verify patient is removed from patient list
      const listRes = await request(app).get('/api/patients');
      expect(listRes.status).toBe(200);
      const found = listRes.body.data.patients.find((p) => p.id === patientId);
      expect(found).toBeUndefined();
    });

    it('should clean up child assessments when patient is deleted', async () => {
      // 1. Create patient
      const createRes = await request(app)
        .post('/api/patients')
        .send({ name: 'Kiran Desai', age: 40, sex: 'male' });
      const patientId = createRes.body.data.patient.id;

      // 2. Create assessment for this patient
      const assessRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          assessment_date: '2026-10-21',
          diet_goal: 'weight_loss',
          diet_category: 'vegetarian',
          prakriti: 'Pitta-Kapha',
          height: 175,
          weight: 82,
        });
      expect(assessRes.status).toBe(201);

      // Verify assessment exists
      const beforeList = await assessmentRepository.findByPatientId(patientId);
      expect(beforeList.length).toBe(1);

      // 3. Delete patient
      const deleteRes = await request(app).delete(`/api/patients/${patientId}`);
      expect(deleteRes.status).toBe(200);

      // 4. Verify assessment is cascade-cleaned
      const afterList = await assessmentRepository.findByPatientId(patientId);
      expect(afterList.length).toBe(0);
    });
  });

  describe('GET /api/patients/:id/dependent-counts', () => {
    it('should return dependent counts for an existing patient', async () => {
      const createRes = await request(app)
        .post('/api/patients')
        .send({ name: 'Devika Pillai', age: 29, sex: 'female' });
      const patientId = createRes.body.data.patient.id;

      const assessRes = await request(app)
        .post(`/api/patients/${patientId}/assessments`)
        .send({
          assessment_date: '2026-10-21',
          diet_goal: 'general_healthy_diet',
          diet_category: 'vegetarian',
          prakriti: 'Vata-Pitta',
          height: 162,
          weight: 56,
        });
      expect(assessRes.status).toBe(201);

      const countRes = await request(app).get(`/api/patients/${patientId}/dependent-counts`);
      expect(countRes.status).toBe(200);
      expect(countRes.body.status).toBe('success');
      expect(countRes.body.data.counts.assessments).toBe(1);
    });

    it('should return 404 for non-existent patient ID', async () => {
      const res = await request(app).get('/api/patients/99999/dependent-counts');
      expect(res.status).toBe(404);
    });
  });
});
