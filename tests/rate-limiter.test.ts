import request from 'supertest';
import express from 'express';
import { rateLimit } from '../src/middleware/rate-limiter';

function createTestApp(maxRequests: number, windowMs: number) {
  const app = express();
  app.use(rateLimit(maxRequests, windowMs));
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Rate Limiter', () => {
  it('allows requests within the limit', async () => {
    const app = createTestApp(3, 60_000);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    }
  });

  it('blocks requests exceeding the limit with 429', async () => {
    const app = createTestApp(2, 60_000);

    await request(app).get('/test');
    await request(app).get('/test');

    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error', 'Too many requests');
    expect(res.body).toHaveProperty('retryAfter');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('resets after the window expires', async () => {
    const app = createTestApp(1, 50); // 50ms window

    await request(app).get('/test');
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));

    const allowed = await request(app).get('/test');
    expect(allowed.status).toBe(200);
  });
});
