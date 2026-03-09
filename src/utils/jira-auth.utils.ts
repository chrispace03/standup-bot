import { JiraTokenResponse, JiraCloudResource } from '../models/jira.model';
import { TokenService } from '../services/token.service';
import { JiraConfig } from '../config/environment';
import { AppError } from '../middleware/error-handler';

const JIRA_SCOPES = 'read:jira-work read:jira-user offline_access';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export function buildJiraAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: JIRA_SCOPES,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
  });
  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

export async function exchangeJiraCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<JiraTokenResponse> {
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new AppError(`Jira token exchange failed: ${response.status}`, 502);
  }

  return response.json() as Promise<JiraTokenResponse>;
}

export async function refreshJiraToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<JiraTokenResponse> {
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new AppError(`Jira token refresh failed: ${response.status}`, 502);
  }

  return response.json() as Promise<JiraTokenResponse>;
}

export async function getAccessibleResources(accessToken: string): Promise<JiraCloudResource[]> {
  const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new AppError(`Failed to fetch Jira resources: ${response.status}`, 502);
  }

  return response.json() as Promise<JiraCloudResource[]>;
}

export async function ensureValidToken(
  slackUserId: string,
  tokenService: TokenService,
  jiraConfig: JiraConfig
): Promise<{ accessToken: string; cloudId: string; siteUrl: string }> {
  const tokens = await tokenService.getTokens(slackUserId);

  if (!tokens?.jira) {
    throw new AppError('Jira not connected', 401);
  }

  const { accessToken, refreshToken, expiresAt, cloudId, siteUrl } = tokens.jira;

  // If token is still valid (with 5-minute buffer), return it
  if (expiresAt.getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return { accessToken, cloudId, siteUrl };
  }

  // Token expired or about to expire — refresh it
  const refreshed = await refreshJiraToken(refreshToken, jiraConfig.clientId, jiraConfig.clientSecret);

  await tokenService.saveJiraTokens(slackUserId, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    scope: refreshed.scope,
    cloudId,
    siteUrl,
  });

  return { accessToken: refreshed.access_token, cloudId, siteUrl };
}
