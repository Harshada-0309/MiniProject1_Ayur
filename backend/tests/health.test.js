const request = require('supertest');
const app = require('../src/app');

describe('Backend Health Check Endpoint', () => {
  it('GET /health should return 200 with service status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'ayurdiet-backend',
    });
  });

  it('GET /non-existent-route should return 404', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
  });
});
