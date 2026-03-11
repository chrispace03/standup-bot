import { AIService, BlockerEntry } from '../src/services/ai.service';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  const createMock = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
    _createMock: createMock,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { _createMock: mockCreate } = require('@anthropic-ai/sdk');

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('returns true when API key is provided', () => {
      const service = new AIService('sk-test-key');
      expect(service.isConfigured).toBe(true);
    });

    it('returns false when API key is not provided', () => {
      const service = new AIService();
      expect(service.isConfigured).toBe(false);
    });

    it('returns false when API key is empty string', () => {
      const service = new AIService('');
      expect(service.isConfigured).toBe(false);
    });
  });

  describe('summarizeBlockers', () => {
    it('returns null when not configured', async () => {
      const service = new AIService();
      const result = await service.summarizeBlockers([
        { date: '2026-03-10', text: 'Blocked on deploy' },
      ]);
      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns null when blockers array is empty', async () => {
      const service = new AIService('sk-test-key');
      const result = await service.summarizeBlockers([]);
      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('calls Claude API and returns summary text', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'The main blocker this week was waiting on API access, which affected two days.' },
        ],
      });

      const service = new AIService('sk-test-key');
      const blockers: BlockerEntry[] = [
        { date: '2026-03-09', text: 'Waiting on API access' },
        { date: '2026-03-10', text: 'Still waiting on API access' },
      ];

      const result = await service.summarizeBlockers(blockers);

      expect(result).toBe('The main blocker this week was waiting on API access, which affected two days.');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Waiting on API access'),
          },
        ],
      });
    });

    it('includes all blocker dates in the prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Summary' }],
      });

      const service = new AIService('sk-test-key');
      await service.summarizeBlockers([
        { date: '2026-03-09', text: 'Blocker A' },
        { date: '2026-03-11', text: 'Blocker B' },
      ]);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('2026-03-09: Blocker A');
      expect(prompt).toContain('2026-03-11: Blocker B');
    });

    it('returns null when API returns no text blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const service = new AIService('sk-test-key');
      const result = await service.summarizeBlockers([
        { date: '2026-03-10', text: 'Some blocker' },
      ]);

      expect(result).toBeNull();
    });
  });
});
