import { validateConfig } from '../src/config/environment';
import type { Config } from '../src/config/environment';

function createTestConfig(overrides: Partial<Config['app']> = {}): Config {
  return {
    app: {
      nodeEnv: 'test',
      port: 3000,
      baseUrl: 'http://localhost:3000',
      encryptionKey: '',
      anthropicApiKey: '',
      ...overrides,
    },
    slack: { clientId: '', clientSecret: '', signingSecret: '', botToken: '' },
    jira: { clientId: '', clientSecret: '', redirectUri: '' },
    google: { clientId: '', clientSecret: '', redirectUri: '' },
    firebase: { projectId: '', privateKey: '', clientEmail: '' },
  };
}

describe('validateConfig', () => {
  it('passes with valid config', () => {
    expect(validateConfig(createTestConfig())).toHaveLength(0);
  });

  it('rejects PORT of 0', () => {
    const errors = validateConfig(createTestConfig({ port: 0 }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('PORT');
  });

  it('rejects negative PORT', () => {
    const errors = validateConfig(createTestConfig({ port: -1 }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects PORT above 65535', () => {
    const errors = validateConfig(createTestConfig({ port: 99999 }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid NODE_ENV', () => {
    const errors = validateConfig(createTestConfig({ nodeEnv: 'staging' }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('NODE_ENV');
  });

  it('accepts production NODE_ENV', () => {
    expect(validateConfig(createTestConfig({ nodeEnv: 'production' }))).toHaveLength(0);
  });
});
