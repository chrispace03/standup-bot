import { config, validateConfig, initializeFirebase, getDb, initSentry } from './config';

// Initialize Sentry before anything else
initSentry();
import { createApp } from './app';
import {
  UserService,
  StandupService,
  TokenService,
  StandupGeneratorService,
  StandupSchedulerService,
  getSlackService,
  AIService,
} from './services';

const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error('[CONFIG] Validation errors:');
  configErrors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
}

try {
  initializeFirebase();
  console.log('[FIREBASE] Firestore initialized successfully');
} catch (err) {
  console.warn('[FIREBASE] Could not initialize Firestore. Database features will be unavailable.');
  console.warn('[FIREBASE]', (err as Error).message);
}

const app = createApp();
const port = config.app.port;

app.listen(port, () => {
  console.log(`[SERVER] Standup Bot API running on port ${port}`);
  console.log(`[SERVER] Environment: ${config.app.nodeEnv}`);
  console.log(`[SERVER] Health check: http://localhost:${port}/api/health`);

  // Start scheduler in non-test environments
  if (config.app.nodeEnv !== 'test') {
    try {
      const db = getDb();
      const userService = new UserService(db);
      const standupService = new StandupService(db);
      const tokenService = new TokenService(db, config.app.encryptionKey);
      const generatorService = new StandupGeneratorService(
        tokenService, standupService, userService, getSlackService(),
        config.jira, config.google,
      );
      const aiService = new AIService(config.app.anthropicApiKey);
      const scheduler = new StandupSchedulerService(userService, standupService, generatorService, getSlackService(), aiService);
      scheduler.start();
    } catch (err) {
      console.warn('[SERVER] Could not start scheduler:', (err as Error).message);
    }
  }
});
