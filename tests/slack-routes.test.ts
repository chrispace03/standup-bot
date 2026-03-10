import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../src/app';

// Mock config
jest.mock('../src/config', () => {
  const originalModule = jest.requireActual('../src/config/environment');
  return {
    config: {
      ...originalModule.config,
      slack: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        signingSecret: 'test-signing-secret',
        botToken: 'xoxb-test-token',
      },
    },
    getDb: jest.fn(() => {
      throw new Error('Firebase not initialized');
    }),
  };
});

const SIGNING_SECRET = 'test-signing-secret';

function signPayload(body: string, timestamp: number): string {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');
  return `v0=${hmac}`;
}

const app = createApp();

describe('Slack Routes', () => {
  describe('POST /slack/commands', () => {
    it('responds to /standup command', async () => {
      const body = 'command=%2Fstandup&text=&user_id=U12345&response_url=https%3A%2F%2Fhooks.slack.com%2Ftest';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/commands')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.response_type).toBe('ephemeral');
      expect(res.body.text).toContain('standup');
    });

    it('responds to /standup-settings command with 200 (fire-and-forget)', async () => {
      const body = 'command=%2Fstandup-settings&user_id=U12345&trigger_id=T123&channel_id=C123&response_url=https%3A%2F%2Fhooks.slack.com%2Ftest';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/commands')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
    });

    it('responds to /standup-connect command with 200 (fire-and-forget)', async () => {
      const body = 'command=%2Fstandup-connect&user_id=U12345&channel_id=C123&response_url=https%3A%2F%2Fhooks.slack.com%2Ftest';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/commands')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
    });

    it('rejects requests without valid signature', async () => {
      const res = await request(app)
        .post('/slack/commands')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('command=%2Fstandup&user_id=U12345');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /slack/events', () => {
    it('responds to url_verification challenge', async () => {
      const body = JSON.stringify({ type: 'url_verification', challenge: 'test-challenge-token' });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/events')
        .set('Content-Type', 'application/json')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.challenge).toBe('test-challenge-token');
    });

    it('acknowledges event_callback', async () => {
      const body = JSON.stringify({
        type: 'event_callback',
        event: { type: 'message', text: 'hello' },
      });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/events')
        .set('Content-Type', 'application/json')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /slack/interactions', () => {
    it('handles block_actions payload', async () => {
      const payload = JSON.stringify({ type: 'block_actions', actions: [] });
      const body = `payload=${encodeURIComponent(payload)}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/interactions')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
    });

    it('handles view_submission payload', async () => {
      const payload = JSON.stringify({ type: 'view_submission', view: {} });
      const body = `payload=${encodeURIComponent(payload)}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(body, timestamp);

      const res = await request(app)
        .post('/slack/interactions')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Slack-Signature', signature)
        .set('X-Slack-Request-Timestamp', String(timestamp))
        .send(body);

      expect(res.status).toBe(200);
    });
  });
});

describe('Auth Routes', () => {
  describe('GET /auth/slack', () => {
    it('redirects to Slack OAuth authorize URL', async () => {
      const res = await request(app).get('/auth/slack');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('slack.com/oauth/v2/authorize');
      expect(res.headers.location).toContain('client_id=test-client-id');
    });
  });

  describe('GET /auth/slack/callback', () => {
    it('returns 400 when code is missing', async () => {
      const res = await request(app).get('/auth/slack/callback');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
