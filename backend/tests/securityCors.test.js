const request = require('supertest');
const app = require('../src/app');

describe('CORS Whitelist & Security Configuration', () => {
  it('should allow requests with no Origin header (server-to-server, curl, tests)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should allow local development origins like http://localhost:5173', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should allow 127.0.0.1 loopback origin in development', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://127.0.0.1:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });

  it('should reject unapproved foreign origins in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalOrigins = process.env.ALLOWED_ORIGINS;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.ayurdiet.clinic';

      // Require a fresh instance with production config
      delete require.cache[require.resolve('../src/app')];
      const prodApp = require('../src/app');

      const rejectedRes = await request(prodApp)
        .get('/health')
        .set('Origin', 'https://malicious-site.example.com');

      // Rejected CORS requests fail error handling
      expect(rejectedRes.status).toBe(500);
      expect(rejectedRes.body.message).toMatch(/CORS blocked/i);

      // Explicitly whitelisted origin succeeds
      const approvedRes = await request(prodApp)
        .get('/health')
        .set('Origin', 'https://app.ayurdiet.clinic');

      expect(approvedRes.status).toBe(200);
      expect(approvedRes.headers['access-control-allow-origin']).toBe('https://app.ayurdiet.clinic');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.ALLOWED_ORIGINS = originalOrigins;
      delete require.cache[require.resolve('../src/app')];
    }
  });
});

