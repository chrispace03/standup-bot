import { JiraService } from '../src/services/jira.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const SERVICE_ARGS = {
  accessToken: 'test-access-token',
  cloudId: 'test-cloud-id',
  siteUrl: 'https://myteam.atlassian.net',
};

function createService(): JiraService {
  return new JiraService(SERVICE_ARGS.accessToken, SERVICE_ARGS.cloudId, SERVICE_ARGS.siteUrl);
}

function mockJsonResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('JiraService', () => {
  describe('getCurrentUser', () => {
    it('returns mapped user on 200', async () => {
      mockJsonResponse({
        accountId: 'acc-123',
        displayName: 'Chris',
        emailAddress: 'chris@example.com',
      });

      const service = createService();
      const user = await service.getCurrentUser();

      expect(user).toEqual({
        accountId: 'acc-123',
        displayName: 'Chris',
        emailAddress: 'chris@example.com',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.atlassian.com/ex/jira/${SERVICE_ARGS.cloudId}/rest/api/3/myself`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${SERVICE_ARGS.accessToken}`,
          }),
        })
      );
    });

    it('throws AppError on 401', async () => {
      mockJsonResponse({ message: 'Unauthorized' }, 401);

      const service = createService();
      await expect(service.getCurrentUser()).rejects.toThrow('Jira API error: 401');
    });
  });

  describe('getRecentlyUpdatedIssues', () => {
    it('sends correct JQL and maps response to JiraIssueReference[]', async () => {
      mockJsonResponse({
        issues: [
          {
            key: 'PROJ-1',
            fields: {
              summary: 'Fix login bug',
              status: { name: 'Done' },
              issuetype: { name: 'Bug' },
            },
          },
          {
            key: 'PROJ-2',
            fields: {
              summary: 'Add dark mode',
              status: { name: 'In Progress' },
              issuetype: { name: 'Story' },
            },
          },
        ],
        total: 2,
        maxResults: 50,
      });

      const service = createService();
      const issues = await service.getRecentlyUpdatedIssues('acc-123', '2026-03-08');

      expect(issues).toEqual([
        {
          issueKey: 'PROJ-1',
          summary: 'Fix login bug',
          status: 'Done',
          issueType: 'Bug',
          url: 'https://myteam.atlassian.net/browse/PROJ-1',
        },
        {
          issueKey: 'PROJ-2',
          summary: 'Add dark mode',
          status: 'In Progress',
          issueType: 'Story',
          url: 'https://myteam.atlassian.net/browse/PROJ-2',
        },
      ]);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('assignee');
      expect(calledUrl).toContain('2026-03-08');
    });

    it('returns empty array when no issues found', async () => {
      mockJsonResponse({ issues: [], total: 0, maxResults: 50 });

      const service = createService();
      const issues = await service.getRecentlyUpdatedIssues('acc-123', '2026-03-08');

      expect(issues).toEqual([]);
    });
  });

  describe('getCurrentSprintIssues', () => {
    it('sends JQL with openSprints() and maps response', async () => {
      mockJsonResponse({
        issues: [
          {
            key: 'PROJ-3',
            fields: {
              summary: 'Sprint task',
              status: { name: 'To Do' },
              issuetype: { name: 'Task' },
            },
          },
        ],
        total: 1,
        maxResults: 50,
      });

      const service = createService();
      const issues = await service.getCurrentSprintIssues('acc-123');

      expect(issues).toHaveLength(1);
      expect(issues[0].issueKey).toBe('PROJ-3');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('openSprints');
    });
  });

  describe('getIssue', () => {
    it('fetches single issue and maps to JiraIssueReference', async () => {
      mockJsonResponse({
        key: 'PROJ-5',
        fields: {
          summary: 'Specific issue',
          status: { name: 'In Review' },
          issuetype: { name: 'Story' },
        },
      });

      const service = createService();
      const issue = await service.getIssue('PROJ-5');

      expect(issue).toEqual({
        issueKey: 'PROJ-5',
        summary: 'Specific issue',
        status: 'In Review',
        issueType: 'Story',
        url: 'https://myteam.atlassian.net/browse/PROJ-5',
      });
    });
  });

  describe('error handling', () => {
    it('throws AppError with 502 for server errors', async () => {
      mockJsonResponse({ message: 'Internal error' }, 500);

      const service = createService();
      await expect(service.getCurrentUser()).rejects.toThrow('Jira API error: 500');
    });

    it('preserves client error status codes', async () => {
      mockJsonResponse({ message: 'Forbidden' }, 403);

      const service = createService();
      try {
        await service.getCurrentUser();
        fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as { statusCode: number }).statusCode).toBe(403);
      }
    });
  });
});
