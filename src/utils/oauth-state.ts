import crypto from 'crypto';

const STATE_SEPARATOR = '.';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates an HMAC-signed OAuth state parameter that encodes the slackUserId
 * and a timestamp, preventing CSRF and replay attacks.
 */
export function createOAuthState(slackUserId: string, secret: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${slackUserId}${STATE_SEPARATOR}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}${STATE_SEPARATOR}${signature}`;
}

/**
 * Verifies and extracts the slackUserId from a signed OAuth state parameter.
 * Throws if the signature is invalid or the state has expired.
 */
export function verifyOAuthState(state: string, secret: string): string {
  const parts = state.split(STATE_SEPARATOR);
  if (parts.length !== 3) {
    throw new Error('Invalid OAuth state format');
  }

  const [slackUserId, timestamp, signature] = parts;
  const payload = `${slackUserId}${STATE_SEPARATOR}${timestamp}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Invalid OAuth state signature');
  }

  const stateTime = parseInt(timestamp, 36);
  if (Date.now() - stateTime > STATE_TTL_MS) {
    throw new Error('OAuth state expired');
  }

  return slackUserId;
}
