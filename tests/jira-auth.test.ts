import {
  buildJiraAuthUrl,
  exchangeJiraCode,
  refreshJiraToken,
  getAccessibleResources,
  ensureValidToken,
} from '../src/utils/jira-auth.utils';
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

describe('buildJiraAuthUrl', () => {
  it('returns URL with all required query params', () => {
    const url = buildJiraAuthUrl('client-id', 'https://example.com/callback', 'U12345');

    expect(url).toContain('https://auth.atlassian.com/authorize');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('redirect_uri=https');
    expect(url).toContain('state=U12345');
    expect(url).toContain('audience=api.atlassian.com');
    expect(url).toContain('response_type=code');
    expect(url).toContain('read%3Ajira-work');
    expect(url).toContain('offline_access');
  });
});

describe('exchangeJiraCode', () => {
  it('exchanges code at correct endpoint and returns tokens', async () => {
    const tokenData = {
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      scope: 'read:jira-work',
    };
    mockJsonResponse(tokenData);

    const result = await exchangeJiraCode('auth-code', 'client-id', 'client-secret', 'https://example.com/callback');

    expect(result).toEqual(tokenData);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.atlassian.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('authorization_code'),
      })
    );
  });

  it('throws on non-2xx response', async () => {
    mockJsonResponse({}, 400);
    await expect(
      exchangeJiraCode('bad-code', 'client-id', 'client-secret', 'https://example.com/callback')
    ).rejects.toThrow('Jira token exchange failed');
  });
});

describe('refreshJiraToken', () => {
  it('refreshes token at correct endpoint', async () => {
    const tokenData = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      scope: 'read:jira-work',
    };
    mockJsonResponse(tokenData);

    const result = await refreshJiraToken('old-refresh', 'client-id', 'client-secret');

    expect(result).toEqual(tokenData);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.atlassian.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('refresh_token'),
      })
    );
  });
});

describe('getAccessibleResources', () => {
  it('returns parsed cloud resources', async () => {
    const resources = [
      { id: 'cloud-123', url: 'https://myteam.atlassian.net', name: 'My Team', scopes: [] },
    ];
    mockJsonResponse(resources);

    const result = await getAccessibleResources('access-token');

    expect(result).toEqual(resources);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token' },
      })
    );
  });
});

describe('ensureValidToken', () => {
  const jiraConfig = { clientId: 'cid', clientSecret: 'csecret', redirectUri: 'https://example.com/callback' };

  function mockTokenService(jiraTokens: Record<string, unknown> | null) {
    return {
      getTokens: jest.fn().mockResolvedValue(
        jiraTokens
          ? { slackUserId: 'U12345', jira: jiraTokens, updatedAt: new Date() }
          : null
      ),
      saveJiraTokens: jest.fn().mockResolvedValue(undefined),
    } as unknown as TokenService;
  }

  it('returns existing token when not expired', async () => {
    const tokenService = mockTokenService({
      accessToken: 'valid-token',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      cloudId: 'cloud-123',
      siteUrl: 'https://myteam.atlassian.net',
    });

    const result = await ensureValidToken('U12345', tokenService, jiraConfig);

    expect(result).toEqual({
      accessToken: 'valid-token',
      cloudId: 'cloud-123',
      siteUrl: 'https://myteam.atlassian.net',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes and saves when token is expired', async () => {
    const tokenService = mockTokenService({
      accessToken: 'expired-token',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() - 1000), // already expired
      cloudId: 'cloud-123',
      siteUrl: 'https://myteam.atlassian.net',
    });

    mockJsonResponse({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      scope: 'read:jira-work',
    });

    const result = await ensureValidToken('U12345', tokenService, jiraConfig);

    expect(result.accessToken).toBe('new-access');
    expect(result.cloudId).toBe('cloud-123');
    expect(tokenService.saveJiraTokens).toHaveBeenCalledWith(
      'U12345',
      expect.objectContaining({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        cloudId: 'cloud-123',
        siteUrl: 'https://myteam.atlassian.net',
      })
    );
  });

  it('throws 401 when no tokens exist', async () => {
    const tokenService = mockTokenService(null);

    await expect(
      ensureValidToken('U12345', tokenService, jiraConfig)
    ).rejects.toThrow('Jira not connected');
  });
});
