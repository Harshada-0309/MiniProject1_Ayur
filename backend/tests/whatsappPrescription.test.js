const request = require('supertest');
const app = require('../src/app');
const {
  normalizePhoneNumber,
  maskPhoneNumber,
  buildPrescriptionMessage,
  generateFallbackUrl,
} = require('../src/services/whatsappService');
const {
  generateToken,
  generatePrescriptionAccessToken,
} = require('../src/services/authService');
const dietPlanRepository = require('../src/repositories/dietPlanRepository');
const patientRepository = require('../src/repositories/patientRepository');
const assessmentRepository = require('../src/repositories/assessmentRepository');
const whatsappAuditRepository = require('../src/repositories/whatsappAuditRepository');

describe('WhatsApp Clinical Prescription Delivery & Number Normalization', () => {
  let authToken;
  let testPatient;
  let approvedPlan;
  let unapprovedPlan;

  beforeAll(async () => {
    // Generate valid dietitian session token
    authToken = generateToken({
      id: 1,
      dietitian_code: 'DIET-2026-001',
      name: 'Dr. Vaidya',
      email: 'vaidya@ayurdiet.clinic',
      role: 'Chief Clinical Dietitian',
    });

    // Create test patient with phone
    testPatient = await patientRepository.create({
      name: 'Aarav Sharma',
      age: 38,
      sex: 'male',
      phone: '+91 98765 43210',
      email: 'aarav.sharma@example.com',
      dietitian_id: 1,
    });

    // Create approved diet plan
    approvedPlan = await dietPlanRepository.create({
      patient_id: testPatient.id,
      title: '7-Day Pitta-Pacifying Regimen',
      status: 'approved',
      is_approved: true,
      approved_by: 'Dr. Vaidya',
      approved_at: new Date().toISOString(),
      patient_summary: 'Comprehensive Pitta balancing nutritional protocol.',
      nutrition_targets: {
        energy: { target_energy_kcal_day: 2000 },
        macronutrients: {
          protein: { target_g: 65 },
          carbohydrate: { target_g: 260 },
          fat: { target_g: 50 },
        },
      },
      days: [
        {
          day_number: 1,
          day_name: 'Monday',
          meals: [
            {
              meal_type: 'breakfast',
              foods: [{ food_name: 'Moong Dal Cheela', calories: 250, protein_g: 10, unit: 'piece', quantity: 2 }],
            },
          ],
        },
      ],
    });

    // Create unapproved diet plan
    unapprovedPlan = await dietPlanRepository.create({
      patient_id: testPatient.id,
      title: 'Draft Regimen',
      status: 'draft',
      is_approved: false,
    });
  });

  afterAll(async () => {
    whatsappAuditRepository._resetMemoryStore();
  });

  describe('1. Phone Number Normalization & Masking', () => {
    it('should normalize 10-digit Indian numbers with country code', () => {
      const res = normalizePhoneNumber('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.e164).toBe('+919876543210');
      expect(res.digitsOnly).toBe('919876543210');
    });

    it('should normalize numbers with spaces, dashes, and leading 0', () => {
      const res = normalizePhoneNumber('098765-43210');
      expect(res.isValid).toBe(true);
      expect(res.e164).toBe('+919876543210');
    });

    it('should normalize existing +91 format with spacing', () => {
      const res = normalizePhoneNumber('+91 98765 43210');
      expect(res.isValid).toBe(true);
      expect(res.e164).toBe('+919876543210');
    });

    it('should reject invalid or short numbers', () => {
      const res1 = normalizePhoneNumber('12345');
      expect(res1.isValid).toBe(false);

      const res2 = normalizePhoneNumber('invalid-phone');
      expect(res2.isValid).toBe(false);
    });

    it('should mask phone numbers cleanly for privacy', () => {
      const masked = maskPhoneNumber('+919876543210');
      expect(masked).toBe('+91 98••• ••210');
    });
  });

  describe('2. WhatsApp Delivery Endpoint (POST /api/diet-plan/:id/whatsapp)', () => {
    it('should reject dispatch if diet plan is not approved', async () => {
      const res = await request(app)
        .post(`/api/diet-plan/${unapprovedPlan.id}/whatsapp`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consent_confirmed: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/must be formally approved/i);
    });

    it('should reject dispatch if explicit patient consent is not confirmed', async () => {
      const res = await request(app)
        .post(`/api/diet-plan/${approvedPlan.id}/whatsapp`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consent_confirmed: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/consent confirmation is required/i);
    });

    it('should reject dispatch if patient has no valid phone and none provided', async () => {
      const noPhonePatient = await patientRepository.create({
        name: 'No Phone Patient',
        age: 30,
        sex: 'female',
        phone: '',
        dietitian_id: 1,
      });

      const noPhonePlan = await dietPlanRepository.create({
        patient_id: noPhonePatient.id,
        status: 'approved',
        is_approved: true,
      });

      const res = await request(app)
        .post(`/api/diet-plan/${noPhonePlan.id}/whatsapp`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consent_confirmed: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/phone number is required/i);
    });

    it('should generate fallback URL with prefilled clinical prescription message when Cloud API is not configured', async () => {
      const res = await request(app)
        .post(`/api/diet-plan/${approvedPlan.id}/whatsapp`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consent_confirmed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.delivery_method).toBe('manual_fallback');
      expect(res.body.data.fallback_url).toContain('https://wa.me/919876543210?text=');
      expect(res.body.data.masked_phone).toBe('+91 98••• ••210');
      expect(res.body.data.message_preview).toContain('Aarav Sharma');
      expect(res.body.data.message_preview).toContain('2000 kcal');
      expect(res.body.data.download_url).toContain(`/api/diet-plan/${approvedPlan.id}/pdf?token=`);
    });

    it('should allow providing updated phone number during dispatch and update patient profile', async () => {
      const res = await request(app)
        .post(`/api/diet-plan/${approvedPlan.id}/whatsapp`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          phone: '9988776655',
          consent_confirmed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.fallback_url).toContain('https://wa.me/919988776655?text=');
      expect(res.body.data.masked_phone).toBe('+91 99••• ••655');

      // Verify patient record updated
      const updatedPatient = await patientRepository.findById(testPatient.id);
      expect(updatedPatient.phone).toBe('+919988776655');
    });
  });

  describe('3. WhatsApp Dispatch History (GET /api/diet-plan/:id/whatsapp-history)', () => {
    it('should retrieve audit log history for dispatches', async () => {
      const res = await request(app)
        .get(`/api/diet-plan/${approvedPlan.id}/whatsapp-history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.history)).toBe(true);
      expect(res.body.data.history.length).toBeGreaterThan(0);
      expect(res.body.data.history[0].plan_id).toBe(approvedPlan.id);
      expect(res.body.data.history[0].delivery_method).toBe('manual_fallback');
    });
  });

  describe('4. Secure Patient Download Token for WhatsApp Link', () => {
    it('should allow downloading PDF via signed prescription access token in query string without Bearer header', async () => {
      const token = generatePrescriptionAccessToken(approvedPlan.id, testPatient.id);

      const res = await request(app)
        .get(`/api/diet-plan/${approvedPlan.id}/pdf?token=${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('should reject access if token is for a different diet plan', async () => {
      const mismatchedToken = generatePrescriptionAccessToken(9999, testPatient.id);

      const res = await request(app)
        .get(`/api/diet-plan/${approvedPlan.id}/pdf?token=${mismatchedToken}`);

      expect(res.status).toBe(403);
    });
  });
});
