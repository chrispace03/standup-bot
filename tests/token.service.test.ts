import { TokenService } from '../src/services/token.service';
import { createMockFirestore } from './helpers/mock-firestore';
import { encrypt } from '../src/utils/encryption';

const TEST_KEY = 'test-encryption-key';

// Helper to create a mock Firestore Timestamp-like object
function mockTimestamp(date: Date) {
  return { toDate: () => date } as unknown as FirebaseFirestore.Timestamp;
}

describe('TokenService', () => {
  let service: TokenService;
  let mocks: ReturnType<typeof createMockFirestore>;

  beforeEach(() => {
    mocks = createMockFirestore();
    service = new TokenService(mocks.db, TEST_KEY);
  });

  describe('getTokens', () => {
    it('returns null when no tokens exist', async () => {
      mocks.mockDocSnapshot.exists = false;

      const result = await service.getTokens('U12345');
      expect(result).toBeNull();
    });

    it('decrypts tokens after reading', async () => {
      const expiresAt = new Date('2026-12-31');
      mocks.mockDocSnapshot.exists = true;
      mocks.mockDocSnapshot.data.mockReturnValue({
        slack: {
          accessToken: encrypt('xoxb-slack-token', TEST_KEY),
          refreshToken: encrypt('xoxr-slack-refresh', TEST_KEY),
          expiresAt: mockTimestamp(expiresAt),
          scope: 'chat:write',
        },
        updatedAt: mockTimestamp(new Date()),
      });

      const result = await service.getTokens('U12345');
      expect(result).not.toBeNull();
      expect(result!.slack!.accessToken).toBe('xoxb-slack-token');
      expect(result!.slack!.refreshToken).toBe('xoxr-slack-refresh');
      expect(result!.slack!.scope).toBe('chat:write');
    });

    it('handles jira tokens with cloudId', async () => {
      mocks.mockDocSnapshot.exists = true;
      mocks.mockDocSnapshot.data.mockReturnValue({
        jira: {
          accessToken: encrypt('jira-token', TEST_KEY),
          refreshToken: encrypt('jira-refresh', TEST_KEY),
          expiresAt: mockTimestamp(new Date()),
          cloudId: 'cloud-123',
          siteUrl: 'https://myteam.atlassian.net',
        },
        updatedAt: mockTimestamp(new Date()),
      });

      const result = await service.getTokens('U12345');
      expect(result!.jira!.accessToken).toBe('jira-token');
      expect(result!.jira!.cloudId).toBe('cloud-123');
      expect(result!.jira!.siteUrl).toBe('https://myteam.atlassian.net');
    });
  });

  describe('saveSlackTokens', () => {
    it('encrypts tokens before saving', async () => {
      await service.saveSlackTokens('U12345', {
        accessToken: 'xoxb-plain',
        refreshToken: 'xoxr-plain',
        expiresAt: new Date('2026-12-31'),
      });

      expect(mocks.mockDocRef.set).toHaveBeenCalled();
      const savedData = mocks.mockDocRef.set.mock.calls[0][0];

      // Tokens should be encrypted (not plaintext)
      expect(savedData.slack.accessToken).not.toBe('xoxb-plain');
      expect(savedData.slack.refreshToken).not.toBe('xoxr-plain');
      expect(savedData.slack.accessToken).toContain(':');
    });
  });

  describe('saveJiraTokens', () => {
    it('preserves cloudId alongside encrypted tokens', async () => {
      await service.saveJiraTokens('U12345', {
        accessToken: 'jira-plain',
        refreshToken: 'jira-refresh',
        expiresAt: new Date('2026-12-31'),
        cloudId: 'cloud-123',
        siteUrl: 'https://myteam.atlassian.net',
      });

      const savedData = mocks.mockDocRef.set.mock.calls[0][0];
      expect(savedData.jira.cloudId).toBe('cloud-123');
      expect(savedData.jira.siteUrl).toBe('https://myteam.atlassian.net');
      expect(savedData.jira.accessToken).not.toBe('jira-plain');
    });
  });

  describe('deleteTokens', () => {
    it('deletes token document', async () => {
      await service.deleteTokens('U12345');
      expect(mocks.mockCollection.doc).toHaveBeenCalledWith('U12345');
      expect(mocks.mockDocRef.delete).toHaveBeenCalled();
    });
  });
});
