import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  ensureValidGoogleToken,
} from '../src/utils/google-auth.utils';
import { TokenService } from '../src/services/token.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

describe('buildGoogleAuthUrl', () => {
  it('returns URL with all required params', () => {
    const url = buildGoogleAuthUrl('client-id', 'https://example.com/callback', 'U12345');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('state=U12345');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('calendar.readonly');
    expect(url).toContain('response_type=code');
  });
});

describe('exchangeGoogleCode', () => {
  it('exchanges code at correct endpoint and returns tokens', async () => {
    const tokenData = {
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      token_type: 'Bearer',
    };
    mockJsonResponse(tokenData);

    const result = await exchangeGoogleCode('auth-code', 'client-id', 'client-secret', 'https://example.com/callback');

    expect(result).toEqual(tokenData);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('authorization_code'),
      })
    );
  });

  it('throws on non-2xx response', async () => {
    mockJsonResponse({}, 400);
    await expect(
      exchangeGoogleCode('bad-code', 'client-id', 'client-secret', 'https://example.com/callback')
    ).rejects.toThrow('Google token exchange failed');
  });
});

describe('refreshGoogleToken', () => {
  it('refreshes token at correct endpoint', async () => {
    const tokenData = {
      access_token: 'new-access',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      token_type: 'Bearer',
    };
    mockJsonResponse(tokenData);

    const result = await refreshGoogleToken('old-refresh', 'client-id', 'client-secret');

    expect(result).toEqual(tokenData);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('refresh_token'),
      })
    );
  });
});

describe('ensureValidGoogleToken', () => {
  const googleConfig = { clientId: 'cid', clientSecret: 'csecret', redirectUri: 'https://example.com/callback' };

  function mockTokenService(googleTokens: Record<string, unknown> | null) {
    return {
      getTokens: jest.fn().mockResolvedValue(
        googleTokens
          ? { slackUserId: 'U12345', google: googleTokens, updatedAt: new Date() }
          : null
      ),
      saveGoogleTokens: jest.fn().mockResolvedValue(undefined),
    } as unknown as TokenService;
  }

  it('returns existing token when not expired', async () => {
    const tokenService = mockTokenService({
      accessToken: 'valid-token',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await ensureValidGoogleToken('U12345', tokenService, googleConfig);

    expect(result).toBe('valid-token');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes when expired and preserves existing refresh token', async () => {
    const tokenService = mockTokenService({
      accessToken: 'expired-token',
      refreshToken: 'original-refresh',
      expiresAt: new Date(Date.now() - 1000),
    });

    // Google refresh response WITHOUT refresh_token (common behavior)
    mockJsonResponse({
      access_token: 'new-access',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      token_type: 'Bearer',
    });

    const result = await ensureValidGoogleToken('U12345', tokenService, googleConfig);

    expect(result).toBe('new-access');
    expect(tokenService.saveGoogleTokens).toHaveBeenCalledWith(
      'U12345',
      expect.objectContaining({
        accessToken: 'new-access',
        refreshToken: 'original-refresh', // preserved from existing
      })
    );
  });

  it('throws 401 when no tokens exist', async () => {
    const tokenService = mockTokenService(null);

    await expect(
      ensureValidGoogleToken('U12345', tokenService, googleConfig)
    ).rejects.toThrow('Google Calendar not connected');
  });
});
