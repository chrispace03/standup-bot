import * as Sentry from '@sentry/node';
import { config } from './environment';

export function initSentry(): void {
  if (!config.app.sentryDsn) {
    console.warn('[SENTRY] No DSN configured. Error monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn: config.app.sentryDsn,
    environment: config.app.nodeEnv,
    tracesSampleRate: config.app.nodeEnv === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      // Strip sensitive data from events
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  console.log('[SENTRY] Error monitoring initialized');
}

export { Sentry };
