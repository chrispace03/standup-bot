import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('environment');
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');
    const timestamp = new Date(res.body.timestamp);
    expect(timestamp.toISOString()).toBe(res.body.timestamp);
  });
});

describe('404 handler', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('statusCode', 404);
  });
});

describe('Stub endpoints', () => {
  it('GET /api/user/:slackId returns stub', async () => {
    const res = await request(app).get('/api/user/U12345');
    expect(res.status).toBe(200);
    expect(res.body.slackId).toBe('U12345');
  });

  it('PUT /api/user/:slackId returns stub', async () => {
    const res = await request(app)
      .put('/api/user/U12345')
      .send({ displayName: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body.slackId).toBe('U12345');
  });

  it('POST /api/standup/trigger returns stub', async () => {
    const res = await request(app).post('/api/standup/trigger');
    expect(res.status).toBe(200);
    expect(res.body.triggered).toBe(false);
  });

  it('GET /api/standup/history returns empty records', async () => {
    const res = await request(app).get('/api/standup/history');
    expect(res.status).toBe(200);
    expect(res.body.records).toEqual([]);
  });
});
