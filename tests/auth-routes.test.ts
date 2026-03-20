import request from 'supertest';
import { createApp } from '../src/app';
import { createOAuthState } from '../src/utils/oauth-state';

const app = createApp();

describe('Auth Routes', () => {
  describe('GET /auth/slack', () => {
    it('redirects to Slack OAuth URL', async () => {
      const res = await request(app).get('/auth/slack');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://slack.com/oauth/v2/authorize');
      expect(res.headers.location).toContain('client_id=');
    });
  });

  describe('GET /auth/slack/callback', () => {
    it('returns 400 without authorization code', async () => {
      const res = await request(app).get('/auth/slack/callback');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/jira', () => {
    it('returns 400 without slackUserId', async () => {
      const res = await request(app).get('/auth/jira');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('slackUserId');
    });

    it('redirects to Jira OAuth URL with signed state', async () => {
      const res = await request(app).get('/auth/jira?slackUserId=U12345');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://auth.atlassian.com/authorize');
      // State should be HMAC-signed (three dot-separated parts), not plain slackUserId
      const url = new URL(res.headers.location);
      const state = url.searchParams.get('state') || '';
      expect(state.split('.')).toHaveLength(3);
      expect(state).not.toBe('U12345');
    });
  });

  describe('GET /auth/jira/callback', () => {
    it('returns 400 without authorization code', async () => {
      const res = await request(app).get('/auth/jira/callback');
      expect(res.status).toBe(400);
    });

    it('returns 400 without state parameter', async () => {
      const res = await request(app).get('/auth/jira/callback?code=test-code');
      expect(res.status).toBe(400);
    });

    it('rejects tampered state with 403', async () => {
      const res = await request(app).get('/auth/jira/callback?code=test-code&state=tampered.state.value');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Invalid or expired OAuth state');
    });
  });

  describe('GET /auth/google', () => {
    it('returns 400 without slackUserId', async () => {
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('slackUserId');
    });

    it('redirects to Google OAuth URL with signed state', async () => {
      const res = await request(app).get('/auth/google?slackUserId=U12345');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      const url = new URL(res.headers.location);
      const state = url.searchParams.get('state') || '';
      expect(state.split('.')).toHaveLength(3);
      expect(state).not.toBe('U12345');
    });
  });

  describe('GET /auth/google/callback', () => {
    it('returns 400 without authorization code', async () => {
      const res = await request(app).get('/auth/google/callback');
      expect(res.status).toBe(400);
    });

    it('rejects tampered state with 403', async () => {
      const res = await request(app).get('/auth/google/callback?code=test-code&state=bad.state.sig');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Invalid or expired OAuth state');
    });
  });
});
