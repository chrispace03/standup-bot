import { createOAuthState, verifyOAuthState } from '../src/utils/oauth-state';

const SECRET = 'test-secret-key-for-hmac-signing';

describe('OAuth State (CSRF protection)', () => {
  describe('createOAuthState', () => {
    it('creates a state string with three dot-separated parts', () => {
      const state = createOAuthState('U12345', SECRET);
      const parts = state.split('.');
      expect(parts).toHaveLength(3);
    });

    it('embeds the slackUserId as the first segment', () => {
      const state = createOAuthState('U12345', SECRET);
      expect(state.startsWith('U12345.')).toBe(true);
    });

    it('produces different states for different users', () => {
      const s1 = createOAuthState('U111', SECRET);
      const s2 = createOAuthState('U222', SECRET);
      expect(s1).not.toEqual(s2);
    });
  });

  describe('verifyOAuthState', () => {
    it('returns the slackUserId for a valid state', () => {
      const state = createOAuthState('U12345', SECRET);
      const userId = verifyOAuthState(state, SECRET);
      expect(userId).toBe('U12345');
    });

    it('throws on tampered signature', () => {
      const state = createOAuthState('U12345', SECRET);
      const tampered = state.slice(0, -4) + 'XXXX';
      expect(() => verifyOAuthState(tampered, SECRET)).toThrow('Invalid OAuth state signature');
    });

    it('throws on wrong secret', () => {
      const state = createOAuthState('U12345', SECRET);
      expect(() => verifyOAuthState(state, 'wrong-secret')).toThrow('Invalid OAuth state signature');
    });

    it('throws on malformed state (missing parts)', () => {
      expect(() => verifyOAuthState('just-one-part', SECRET)).toThrow('Invalid OAuth state format');
      expect(() => verifyOAuthState('two.parts', SECRET)).toThrow('Invalid OAuth state format');
    });

    it('throws on expired state', () => {
      // Manually build a state with a timestamp 11 minutes ago
      const crypto = require('crypto');
      const oldTimestamp = (Date.now() - 11 * 60 * 1000).toString(36);
      const payload = `U12345.${oldTimestamp}`;
      const signature = crypto
        .createHmac('sha256', SECRET)
        .update(payload)
        .digest('base64url');
      const expiredState = `${payload}.${signature}`;

      expect(() => verifyOAuthState(expiredState, SECRET)).toThrow('OAuth state expired');
    });
  });
});
