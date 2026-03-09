import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';

const FIVE_MINUTES = 5 * 60;

export function slackVerify(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-slack-signature'] as string | undefined;
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;

  if (!signature || !timestamp) {
    res.status(401).json({ error: 'Missing Slack signature headers' });
    return;
  }

  // Reject requests older than 5 minutes (replay attack protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > FIVE_MINUTES) {
    res.status(401).json({ error: 'Request timestamp too old' });
    return;
  }

  if (!req.rawBody) {
    res.status(401).json({ error: 'Missing raw body for verification' });
    return;
  }

  const sigBasestring = `v0:${timestamp}:${req.rawBody.toString()}`;
  const hmac = crypto
    .createHmac('sha256', config.slack.signingSecret)
    .update(sigBasestring)
    .digest('hex');
  const expectedSignature = `v0=${hmac}`;

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}
