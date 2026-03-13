import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeFirebase, getDb, config } from './config';
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

initializeFirebase();

const expressApp = createApp();

// HTTP function — serves the entire Express app
export const api = onRequest(expressApp);

// Scheduled function — replaces node-cron in production
export const scheduledTick = onSchedule('* * * * *', async () => {
  const db = getDb();
  const userService = new UserService(db);
  const standupService = new StandupService(db);
  const tokenService = new TokenService(db, config.app.encryptionKey);
  const generatorService = new StandupGeneratorService(
    tokenService, standupService, userService, getSlackService(),
    config.jira, config.google,
  );
  const aiService = new AIService(config.app.anthropicApiKey);
  const scheduler = new StandupSchedulerService(
    userService, standupService, generatorService, getSlackService(), aiService,
  );
  await scheduler.tick();
});
