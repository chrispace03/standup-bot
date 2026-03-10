import { GoogleTokenResponse } from '../models/google-calendar.model';
import { TokenService } from '../services/token.service';
import { GoogleConfig } from '../config/environment';
import { AppError } from '../middleware/error-handler';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
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
    throw new AppError(`Google token exchange failed: ${response.status}`, 502);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
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
    throw new AppError(`Google token refresh failed: ${response.status}`, 502);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

export async function ensureValidGoogleToken(
  slackUserId: string,
  tokenService: TokenService,
  googleConfig: GoogleConfig
): Promise<string> {
  const tokens = await tokenService.getTokens(slackUserId);

  if (!tokens?.google) {
    throw new AppError('Google Calendar not connected', 401);
  }

  const { accessToken, refreshToken, expiresAt } = tokens.google;

  // If token is still valid (with 5-minute buffer), return it
  if (expiresAt.getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return accessToken;
  }

  // Token expired or about to expire — refresh it
  const refreshed = await refreshGoogleToken(refreshToken, googleConfig.clientId, googleConfig.clientSecret);

  await tokenService.saveGoogleTokens(slackUserId, {
    accessToken: refreshed.access_token,
    // Google may not return a new refresh token — preserve the existing one
    refreshToken: refreshed.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    scope: refreshed.scope,
  });

  return refreshed.access_token;
}
