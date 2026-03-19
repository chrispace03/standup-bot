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

describe('Database-backed routes without Firebase', () => {
  it('GET /api/user/:slackId returns 503 when database unavailable', async () => {
    const res = await request(app).get('/api/user/U12345');
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/standup/trigger returns 400 without userId', async () => {
    const res = await request(app).post('/api/standup/trigger').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/standup/history returns 400 without userId', async () => {
    const res = await request(app).get('/api/standup/history');
    expect(res.status).toBe(400);
  });

  it('GET /api/standup/by-issue returns 400 without issueKey', async () => {
    const res = await request(app).get('/api/standup/by-issue');
    expect(res.status).toBe(400);
  });
});
