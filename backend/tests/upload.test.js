const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const dietitianRepository = require('../src/repositories/dietitianRepository');
const patientRepository = require('../src/repositories/patientRepository');

describe('File Upload & Multi-Practitioner Persistence APIs', () => {
  let tokenDietitian1;
  let tokenDietitian2;
  let testPatientId;
  const tempTestFiles = [];

  // Helper to create small genuine test image files
  function createTestImage(filename, type) {
    const filePath = path.join(__dirname, filename);
    let buffer;
    if (type === 'jpeg') {
      // Valid JPEG header
      buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    } else if (type === 'png') {
      // Valid PNG header
      buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    } else {
      // Fake text file
      buffer = Buffer.from('This is a plain text file pretending to be an image');
    }
    fs.writeFileSync(filePath, buffer);
    tempTestFiles.push(filePath);
    return filePath;
  }

  beforeAll(async () => {
    dietitianRepository._resetMemoryStore();
    patientRepository._resetMemoryStore();

    // 1. Authenticate Dr. Vaidya
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vaidya@ayurdiet.clinic', password: 'AyurDiet@2026' });
    expect(res1.status).toBe(200);
    tokenDietitian1 = res1.body.data.token;

    // 2. Authenticate Dr. Rajesh Sharma
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dr.sharma@ayurdiet.clinic', password: 'AyurDiet@2026' });
    expect(res2.status).toBe(200);
    tokenDietitian2 = res2.body.data.token;

    // 3. Create a test patient
    const patientRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${tokenDietitian1}`)
      .send({
        name: 'Test Persistent Patient',
        age: 32,
        sex: 'female',
        phone: '+91 99887 76655',
      });
    expect(patientRes.status).toBe(201);
    testPatientId = patientRes.body.data.patient.id;
  });

  afterAll(() => {
    // Clean up temporary test image files
    tempTestFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (e) {}
    });
  });

  describe('Multi-Dietitian Isolation & Retrieval', () => {
    it('should distinguish Dr. Vaidya from Dr. Rajesh Sharma with different IDs and roles', async () => {
      const me1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenDietitian1}`);
      const me2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenDietitian2}`);

      expect(me1.status).toBe(200);
      expect(me2.status).toBe(200);

      expect(me1.body.data.dietitian.name).toBe('Dr. Vaidya');
      expect(me1.body.data.dietitian.role).toBe('Chief Clinical Dietitian');

      expect(me2.body.data.dietitian.name).toBe('Dr. Rajesh Sharma');
      expect(me2.body.data.dietitian.role).toBe('Senior Ayurvedic Consultant');

      expect(me1.body.data.dietitian.id).not.toBe(me2.body.data.dietitian.id);
    });

    it('should list all available clinic dietitians via GET /api/auth/dietitians', async () => {
      const res = await request(app).get('/api/auth/dietitians');
      expect(res.status).toBe(200);
      expect(res.body.data.dietitians.length).toBeGreaterThanOrEqual(2);
      const emails = res.body.data.dietitians.map((d) => d.email.toLowerCase());
      expect(emails).toContain('vaidya@ayurdiet.clinic');
      expect(emails).toContain('dr.sharma@ayurdiet.clinic');
    });
  });

  describe('Dietitian & Patient Photo Uploads', () => {
    it('should reject upload without authentication', async () => {
      const res = await request(app)
        .post('/api/upload/dietitian-photo')
        .set('x-enforce-auth', 'true');
      expect(res.status).toBe(401);
    });

    it('should reject fake files or invalid signatures with 400', async () => {
      const fakeFile = createTestImage('fake.jpg', 'text');
      const res = await request(app)
        .post('/api/upload/dietitian-photo')
        .set('Authorization', `Bearer ${tokenDietitian1}`)
        .attach('photo', fakeFile);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/signature is invalid|only genuine/i);
    });

    it('should accept genuine JPEG image, save to disk, and update dietitian photo_url', async () => {
      const validJpeg = createTestImage('valid_avatar.jpg', 'jpeg');
      const res = await request(app)
        .post('/api/upload/dietitian-photo')
        .set('Authorization', `Bearer ${tokenDietitian1}`)
        .attach('photo', validJpeg);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.photo_url).toMatch(/^\/uploads\/dietitians\//);

      // Verify static route serves the uploaded file
      const staticRes = await request(app).get(res.body.data.photo_url);
      expect(staticRes.status).toBe(200);

      // Verify that GET /api/auth/me now returns the new photo_url
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenDietitian1}`);
      expect(meRes.body.data.dietitian.photo_url).toBe(res.body.data.photo_url);
    });

    it('should accept genuine PNG image and update patient photo_url', async () => {
      const validPng = createTestImage('patient_pic.png', 'png');
      const res = await request(app)
        .post(`/api/upload/patient-photo/${testPatientId}`)
        .set('Authorization', `Bearer ${tokenDietitian1}`)
        .attach('photo', validPng);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.photo_url).toMatch(/^\/uploads\/patients\//);

      // Verify patient retrieval returns the persisted photo_url
      const getPatient = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${tokenDietitian1}`);
      expect(getPatient.body.data.patient.photo_url).toBe(res.body.data.photo_url);
    });

    it('should prevent unauthorized practitioner from uploading photo for another practitioner patient', async () => {
      const validPng = createTestImage('unauth_pic.png', 'png');
      const res = await request(app)
        .post(`/api/upload/patient-photo/${testPatientId}`)
        .set('Authorization', `Bearer ${tokenDietitian2}`)
        .attach('photo', validPng);

      expect([403, 404]).toContain(res.status);
    });

    it('should delete dietitian photo and persist photo_url as null', async () => {
      const res = await request(app)
        .delete('/api/upload/dietitian-photo')
        .set('Authorization', `Bearer ${tokenDietitian1}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.photo_url).toBeNull();
      expect(res.body.data.token).toBeDefined();

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.data.token}`);
      expect(meRes.body.data.dietitian.photo_url).toBeNull();
    });

    it('should delete patient photo and persist photo_url as null', async () => {
      const res = await request(app)
        .delete(`/api/upload/patient-photo/${testPatientId}`)
        .set('Authorization', `Bearer ${tokenDietitian1}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.patient.photo_url).toBeNull();

      const getPatient = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${tokenDietitian1}`);
      expect(getPatient.body.data.patient.photo_url).toBeNull();
    });
  });

  describe('PUT /api/auth/profile Multipart & Fields Update', () => {
    it('should update dietitian details and photo simultaneously via multipart/form-data', async () => {
      const validJpeg = createTestImage('profile_upload.jpg', 'jpeg');
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${tokenDietitian1}`)
        .field('name', 'Dr. Vaidya Updated')
        .field('role', 'Chief Ayurvedic Medical Officer')
        .field('phone', '+91 91234 56789')
        .field('qualifications', 'BAMS, MD, DSc Clinical Ayurveda')
        .field('clinic_name', 'AyurDiet Global Research Center')
        .attach('photo', validJpeg);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.dietitian.name).toBe('Dr. Vaidya Updated');
      expect(res.body.data.dietitian.role).toBe('Chief Ayurvedic Medical Officer');
      expect(res.body.data.dietitian.phone).toBe('+91 91234 56789');
      expect(res.body.data.dietitian.photo_url).toMatch(/^\/uploads\/dietitians\//);

      // Verify the uploaded photo is accessible via static endpoint
      const staticCheck = await request(app).get(res.body.data.dietitian.photo_url);
      expect(staticCheck.status).toBe(200);

      // Verify persistence via GET /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.data.token}`);
      expect(meRes.body.data.dietitian.name).toBe('Dr. Vaidya Updated');
      expect(meRes.body.data.dietitian.photo_url).toBe(res.body.data.dietitian.photo_url);
    });

    it('should update profile fields without photo via standard application/json', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${tokenDietitian1}`)
        .send({
          name: 'Dr. Vaidya Permanent',
          phone: '+91 98765 43210',
          clinic_name: 'AyurDiet Main Clinic',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.dietitian.name).toBe('Dr. Vaidya Permanent');
      expect(res.body.data.dietitian.phone).toBe('+91 98765 43210');
      // Preserves existing photo_url
      expect(res.body.data.dietitian.photo_url).toMatch(/^\/uploads\/dietitians\//);
    });

    it('should reject profile update when name is empty', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${tokenDietitian1}`)
        .send({
          name: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/name is required|cannot be empty/i);
    });
  });
});

