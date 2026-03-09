import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  nodeEnv: string;
  port: number;
  baseUrl: string;
  encryptionKey: string;
}

export interface SlackConfig {
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  botToken: string;
}

export interface JiraConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export interface Config {
  app: AppConfig;
  slack: SlackConfig;
  jira: JiraConfig;
  google: GoogleConfig;
  firebase: FirebaseConfig;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  return '';
}

function buildConfig(): Config {
  return {
    app: {
      nodeEnv: getEnv('NODE_ENV', 'development'),
      port: parseInt(getEnv('PORT', '3000'), 10),
      baseUrl: getEnv('BASE_URL', 'http://localhost:3000'),
      encryptionKey: getEnv('ENCRYPTION_KEY'),
    },
    slack: {
      clientId: getEnv('SLACK_CLIENT_ID'),
      clientSecret: getEnv('SLACK_CLIENT_SECRET'),
      signingSecret: getEnv('SLACK_SIGNING_SECRET'),
      botToken: getEnv('SLACK_BOT_TOKEN'),
    },
    jira: {
      clientId: getEnv('JIRA_CLIENT_ID'),
      clientSecret: getEnv('JIRA_CLIENT_SECRET'),
      redirectUri: getEnv('JIRA_REDIRECT_URI'),
    },
    google: {
      clientId: getEnv('GOOGLE_CLIENT_ID'),
      clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
      redirectUri: getEnv('GOOGLE_REDIRECT_URI'),
    },
    firebase: {
      projectId: getEnv('FIREBASE_PROJECT_ID'),
      privateKey: getEnv('FIREBASE_PRIVATE_KEY'),
      clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
    },
  };
}

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (isNaN(config.app.port) || config.app.port <= 0 || config.app.port > 65535) {
    errors.push('PORT must be a valid number between 1 and 65535');
  }

  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(config.app.nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
  }

  if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
    console.warn('[CONFIG] Firebase credentials not fully configured. Database features will be unavailable.');
  }

  if (!config.app.encryptionKey) {
    console.warn('[CONFIG] ENCRYPTION_KEY not set. Token encryption will not work.');
  }

  if (!config.slack.clientId || !config.slack.clientSecret || !config.slack.signingSecret) {
    console.warn('[CONFIG] Slack credentials not fully configured. Slack integration will be unavailable.');
  }

  return errors;
}

export const config: Config = Object.freeze(buildConfig());
