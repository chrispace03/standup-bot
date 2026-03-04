import { config, validateConfig } from './config';
import { createApp } from './app';

const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error('[CONFIG] Validation errors:');
  configErrors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
}

const app = createApp();
const port = config.app.port;

app.listen(port, () => {
  console.log(`[SERVER] Standup Bot API running on port ${port}`);
  console.log(`[SERVER] Environment: ${config.app.nodeEnv}`);
  console.log(`[SERVER] Health check: http://localhost:${port}/api/health`);
});
