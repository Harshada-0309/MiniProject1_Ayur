const request = require('supertest');
const app = require('../src/app');
const dietitianRepository = require('../src/repositories/dietitianRepository');
const { validateJwtSecret, DEV_DEFAULT_SECRET } = require('../src/services/authService');

describe('Dietitian Authentication & Route Protection APIs', () => {
  beforeEach(() => {
    dietitianRepository._resetMemoryStore();
  });

  describe('POST /api/auth/login', () => {
    it('should fail with 400 when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'vaidya@ayurdiet.clinic' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
    });

    it('should fail with 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'vaidya@ayurdiet.clinic',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('should fail with 401 for non-existent dietitian email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@ayurdiet.clinic',
          password: 'AyurDiet@2026',
        });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('should successfully authenticate registered dietitian with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'vaidya@ayurdiet.clinic',
          password: 'AyurDiet@2026',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.dietitian).toBeDefined();
      expect(res.body.data.dietitian.name).toBe('Dr. Vaidya');
      expect(res.body.data.dietitian.role).toBe('Chief Clinical Dietitian');
    });
  });

  describe('Protected Routes & Token Enforcement', () => {
    let validToken;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'vaidya@ayurdiet.clinic',
          password: 'AyurDiet@2026',
        });
      validToken = res.body.data.token;
    });

    it('should return practitioner profile on GET /api/auth/me with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.dietitian.email).toBe('vaidya@ayurdiet.clinic');
    });

    it('should reject unauthenticated request on private endpoint with 401 when auth is enforced', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('x-enforce-auth', 'true');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/authentication required/i);
    });

    it('should reject request with forged or invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', 'Bearer forged.token.signature');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('should allow access to private patient APIs with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.patients).toBeDefined();
    });

    it('should invalidate token on POST /api/auth/logout and block subsequent requests', async () => {
      // 1. Obtain a fresh session token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'vaidya@ayurdiet.clinic',
          password: 'AyurDiet@2026',
        });
      const sessionToken = loginRes.body.data.token;

      // 2. Perform logout with session token
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.status).toBe('success');

      // 3. Attempting to use the invalidated token must fail with 401
      const retryRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(retryRes.status).toBe(401);
      expect(retryRes.body.message).toMatch(/invalidated/i);
    });

    it('should successfully update dietitian profile via PUT /api/auth/profile', async () => {
      const updatePayload = {
        name: 'Dr. Arya Vaidya, BAMS',
        role: 'Senior Ayurvedic Clinical Nutritionist',
        qualifications: 'BAMS, MD (Ayurveda), PGDCN',
        clinic_name: 'AyurDiet Integrative Clinical Center',
        phone: '+91 98765 43210',
        photo_url: 'data:image/jpeg;base64,samplephoto123',
      };

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.dietitian.name).toBe(updatePayload.name);
      expect(res.body.data.dietitian.role).toBe(updatePayload.role);
      expect(res.body.data.dietitian.qualifications).toBe(updatePayload.qualifications);
      expect(res.body.data.dietitian.clinic_name).toBe(updatePayload.clinic_name);
      expect(res.body.data.dietitian.phone).toBe(updatePayload.phone);
      expect(res.body.data.dietitian.photo_url).toBe(updatePayload.photo_url);

      // Verify that subsequent GET /api/auth/me returns the updated profile
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.dietitian.name).toBe(updatePayload.name);
      expect(meRes.body.data.dietitian.qualifications).toBe(updatePayload.qualifications);
    });

    it('should reject profile update with invalid or non-bearer token', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('x-enforce-auth', 'true')
        .send({ name: 'Hacker' });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });

  describe('Production JWT_SECRET Enforcement', () => {
    it('should allow default secret in development and test environments', () => {
      const resDev = validateJwtSecret('development', DEV_DEFAULT_SECRET);
      expect(resDev.valid).toBe(true);

      const resTest = validateJwtSecret('test', undefined);
      expect(resTest.valid).toBe(true);
    });

    it('should fail in production if JWT_SECRET is missing or empty', () => {
      expect(() => validateJwtSecret('production', '')).toThrow(/JWT_SECRET must be explicitly configured/i);
      expect(() => validateJwtSecret('production', undefined)).toThrow(/JWT_SECRET must be explicitly configured/i);
    });

    it('should fail in production if JWT_SECRET uses known development default', () => {
      expect(() => validateJwtSecret('production', DEV_DEFAULT_SECRET)).toThrow(/cannot use the known development default/i);
      expect(() => validateJwtSecret('production', 'secret')).toThrow(/cannot use the known development default/i);
    });

    it('should fail in production if JWT_SECRET is less than 32 characters', () => {
      expect(() => validateJwtSecret('production', 'short-secret-12345')).toThrow(/must be a strong key of at least 32 characters/i);
    });

    it('should succeed in production when given a strong key >= 32 characters', () => {
      const strongKey = 'prod-strong-cryptographic-secret-key-ayurdiet-2026-secure';
      const res = validateJwtSecret('production', strongKey);
      expect(res.valid).toBe(true);
      expect(res.secret).toBe(strongKey);
    });
  });
});
