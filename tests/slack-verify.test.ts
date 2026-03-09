import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { slackVerify } from '../src/middleware/slack-verify';

// Mock the config module
jest.mock('../src/config', () => ({
  config: {
    slack: {
      signingSecret: 'test-signing-secret',
    },
  },
}));

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    rawBody: undefined,
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function signRequest(body: string, secret: string, timestamp: number): string {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(sigBasestring)
    .digest('hex');
  return `v0=${hmac}`;
}

describe('slackVerify middleware', () => {
  const next: NextFunction = jest.fn();
  const secret = 'test-signing-secret';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes with a valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = '{"text":"hello"}';
    const signature = signRequest(body, secret, timestamp);

    const req = createMockReq({
      headers: {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': String(timestamp),
      },
      rawBody: Buffer.from(body),
    });

    const res = createMockRes();
    slackVerify(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects when signature header is missing', () => {
    const req = createMockReq({
      headers: { 'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)) },
      rawBody: Buffer.from('body'),
    });

    const res = createMockRes();
    slackVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing Slack signature headers' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when timestamp header is missing', () => {
    const req = createMockReq({
      headers: { 'x-slack-signature': 'v0=abc' },
      rawBody: Buffer.from('body'),
    });

    const res = createMockRes();
    slackVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing Slack signature headers' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when timestamp is too old (replay attack)', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 6 * 60; // 6 minutes ago
    const body = 'body';
    const signature = signRequest(body, secret, oldTimestamp);

    const req = createMockReq({
      headers: {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': String(oldTimestamp),
      },
      rawBody: Buffer.from(body),
    });

    const res = createMockRes();
    slackVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request timestamp too old' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when rawBody is missing', () => {
    const timestamp = Math.floor(Date.now() / 1000);

    const req = createMockReq({
      headers: {
        'x-slack-signature': 'v0=abc',
        'x-slack-request-timestamp': String(timestamp),
      },
      // no rawBody
    });

    const res = createMockRes();
    slackVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing raw body for verification' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when signature does not match (tampered body)', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest('original-body', secret, timestamp);

    const req = createMockReq({
      headers: {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': String(timestamp),
      },
      rawBody: Buffer.from('tampered-body'),
    });

    const res = createMockRes();
    slackVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    expect(next).not.toHaveBeenCalled();
  });
});
