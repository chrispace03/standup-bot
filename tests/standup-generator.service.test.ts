import { StandupGeneratorService } from '../src/services/standup-generator.service';
import { TokenService } from '../src/services/token.service';
import { StandupService } from '../src/services/standup.service';
import { UserService } from '../src/services/user.service';
import { SlackService } from '../src/services/slack.service';
import { User } from '../src/models';

jest.mock('../src/utils/jira-auth.utils', () => ({
  ensureValidToken: jest.fn(),
}));
jest.mock('../src/utils/google-auth.utils', () => ({
  ensureValidGoogleToken: jest.fn(),
}));
jest.mock('../src/services/jira.service', () => ({
  JiraService: jest.fn().mockImplementation(() => ({
    getRecentlyUpdatedIssues: jest.fn().mockResolvedValue([]),
    getCurrentSprintIssues: jest.fn().mockResolvedValue([]),
  })),
}));
jest.mock('../src/services/google-calendar.service', () => ({
  GoogleCalendarService: jest.fn().mockImplementation(() => ({
    getTodayEvents: jest.fn().mockResolvedValue([]),
  })),
}));

import { ensureValidToken } from '../src/utils/jira-auth.utils';
import { ensureValidGoogleToken } from '../src/utils/google-auth.utils';
import { JiraService } from '../src/services/jira.service';
import { GoogleCalendarService } from '../src/services/google-calendar.service';

const mockedEnsureValidToken = ensureValidToken as jest.MockedFunction<typeof ensureValidToken>;
const mockedEnsureValidGoogleToken = ensureValidGoogleToken as jest.MockedFunction<typeof ensureValidGoogleToken>;
const MockedJiraService = JiraService as jest.MockedClass<typeof JiraService>;
const MockedGoogleCalendarService = GoogleCalendarService as jest.MockedClass<typeof GoogleCalendarService>;

const jiraConfig = { clientId: 'jc', clientSecret: 'js', redirectUri: 'http://localhost/jira/cb' };
const googleConfig = { clientId: 'gc', clientSecret: 'gs', redirectUri: 'http://localhost/google/cb' };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    slackUserId: 'U12345',
    slackTeamId: 'T12345',
    displayName: 'Test User',
    email: 'test@example.com',
    timezone: 'UTC',
    standupTime: '09:00',
    standupEnabled: true,
    standupDays: [1, 2, 3, 4, 5],
    googleConnected: true,
    jiraAccountId: 'jira-acct-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMocks() {
  const tokenService = {
    getTokens: jest.fn(),
    saveSlackTokens: jest.fn(),
    saveJiraTokens: jest.fn(),
    saveGoogleTokens: jest.fn(),
  } as unknown as TokenService;

  const standupService = {
    save: jest.fn().mockResolvedValue(undefined),
    getById: jest.fn(),
  } as unknown as StandupService;

  const userService = {
    getBySlackId: jest.fn(),
  } as unknown as UserService;

  const slackService = {
    postMessage: jest.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456', channel: 'C123' }),
    postEphemeral: jest.fn().mockResolvedValue(undefined),
  } as unknown as SlackService;

  return { tokenService, standupService, userService, slackService };
}

const jiraIssues = [
  { issueKey: 'PROJ-1', summary: 'Fix bug', status: 'Done', issueType: 'Bug', url: 'https://jira.example.com/PROJ-1' },
];
const sprintIssues = [
  { issueKey: 'PROJ-2', summary: 'New feature', status: 'In Progress', issueType: 'Story', url: 'https://jira.example.com/PROJ-2' },
];
const calendarEvents = [
  { eventId: 'evt-1', title: 'Team Standup', startTime: new Date('2026-03-10T09:00:00Z'), endTime: new Date('2026-03-10T09:15:00Z'), isAllDay: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Pin the date to Tuesday 2026-03-10 at 10:00 UTC
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-03-10T10:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StandupGeneratorService', () => {
  describe('generate()', () => {
    it('generates full standup with Jira + Google data and posts to Slack', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockResolvedValue({ accessToken: 'jira-token', cloudId: 'cloud-1', siteUrl: 'https://jira.example.com' });
      mockedEnsureValidGoogleToken.mockResolvedValue('google-token');

      MockedJiraService.mockImplementation(() => ({
        getRecentlyUpdatedIssues: jest.fn().mockResolvedValue(jiraIssues),
        getCurrentSprintIssues: jest.fn().mockResolvedValue(sprintIssues),
        getCurrentUser: jest.fn(),
        getIssue: jest.fn(),
      }) as unknown as JiraService);

      MockedGoogleCalendarService.mockImplementation(() => ({
        getTodayEvents: jest.fn().mockResolvedValue(calendarEvents),
      }) as unknown as GoogleCalendarService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      const result = await generator.generate('U12345', 'C123');

      expect(result.posted).toBe(true);
      expect(result.record.yesterday).toEqual(jiraIssues);
      expect(result.record.today).toEqual(sprintIssues);
      expect(result.record.events).toEqual(calendarEvents);
      expect(result.record.date).toBe('2026-03-10');
      expect(result.record.userId).toBe('U12345');
      expect(standupService.save).toHaveBeenCalledTimes(2); // once before post, once after
      expect(slackService.postMessage).toHaveBeenCalledWith('C123', expect.any(Array), expect.any(String));
    });

    it('returns empty Jira sections when Jira is not connected', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockRejectedValue(new Error('Jira not connected'));
      mockedEnsureValidGoogleToken.mockResolvedValue('google-token');

      MockedGoogleCalendarService.mockImplementation(() => ({
        getTodayEvents: jest.fn().mockResolvedValue(calendarEvents),
      }) as unknown as GoogleCalendarService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      const result = await generator.generate('U12345', 'C123');

      expect(result.record.yesterday).toEqual([]);
      expect(result.record.today).toEqual([]);
      expect(result.record.events).toEqual(calendarEvents);
      expect(result.posted).toBe(true);
    });

    it('returns empty events when Google is not connected', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockResolvedValue({ accessToken: 'jira-token', cloudId: 'cloud-1', siteUrl: 'https://jira.example.com' });
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('Google Calendar not connected'));

      MockedJiraService.mockImplementation(() => ({
        getRecentlyUpdatedIssues: jest.fn().mockResolvedValue(jiraIssues),
        getCurrentSprintIssues: jest.fn().mockResolvedValue(sprintIssues),
        getCurrentUser: jest.fn(),
        getIssue: jest.fn(),
      }) as unknown as JiraService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      const result = await generator.generate('U12345', 'C123');

      expect(result.record.yesterday).toEqual(jiraIssues);
      expect(result.record.today).toEqual(sprintIssues);
      expect(result.record.events).toEqual([]);
    });

    it('generates standup with all empty sections when both services fail', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockRejectedValue(new Error('Jira not connected'));
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('Google not connected'));

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      const result = await generator.generate('U12345', 'C123');

      expect(result.record.yesterday).toEqual([]);
      expect(result.record.today).toEqual([]);
      expect(result.record.events).toEqual([]);
      expect(standupService.save).toHaveBeenCalled();
      expect(slackService.postMessage).toHaveBeenCalled();
    });

    it('throws AppError 404 when user is not found', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(null);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);

      await expect(generator.generate('U99999')).rejects.toThrow('User not registered');
    });

    it('saves but does not post when no channelId is provided', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockRejectedValue(new Error('skip'));
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('skip'));

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      const result = await generator.generate('U12345');

      expect(result.posted).toBe(false);
      expect(standupService.save).toHaveBeenCalledTimes(1);
      expect(slackService.postMessage).not.toHaveBeenCalled();
    });

    it('still saves record when Slack post fails', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockRejectedValue(new Error('skip'));
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('skip'));
      (slackService.postMessage as jest.Mock).mockRejectedValue(new Error('Slack API error'));

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);

      await expect(generator.generate('U12345', 'C123')).rejects.toThrow('Slack API error');
      // Record was saved before the post attempt
      expect(standupService.save).toHaveBeenCalledTimes(1);
    });

    it('skips Jira sections when user has no jiraAccountId', async () => {
      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser({ jiraAccountId: undefined }));
      mockedEnsureValidGoogleToken.mockResolvedValue('google-token');

      MockedGoogleCalendarService.mockImplementation(() => ({
        getTodayEvents: jest.fn().mockResolvedValue(calendarEvents),
      }) as unknown as GoogleCalendarService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      const result = await generator.generate('U12345');

      expect(result.record.yesterday).toEqual([]);
      expect(result.record.today).toEqual([]);
      expect(result.record.events).toEqual(calendarEvents);
      // ensureValidToken should not have been called
      expect(mockedEnsureValidToken).not.toHaveBeenCalled();
    });
  });

  describe('getLastWorkingDay (tested via generate)', () => {
    it('uses Friday as yesterday for Monday standup with default weekdays', async () => {
      const monday = new Date('2026-03-09T10:00:00Z');

      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockResolvedValue({ accessToken: 'jira-token', cloudId: 'cloud-1', siteUrl: 'https://jira.example.com' });
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('skip'));

      const mockGetRecentlyUpdated = jest.fn().mockResolvedValue(jiraIssues);
      MockedJiraService.mockImplementation(() => ({
        getRecentlyUpdatedIssues: mockGetRecentlyUpdated,
        getCurrentSprintIssues: jest.fn().mockResolvedValue([]),
        getCurrentUser: jest.fn(),
        getIssue: jest.fn(),
      }) as unknown as JiraService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      await generator.generate('U12345', undefined, monday);

      // Should have called with Friday 2026-03-06
      expect(mockGetRecentlyUpdated).toHaveBeenCalledWith('jira-acct-1', '2026-03-06');
    });

    it('uses Monday as yesterday for Wednesday standup with Mon/Wed/Fri schedule', async () => {
      const wednesday = new Date('2026-03-11T10:00:00Z');

      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser({ standupDays: [1, 3, 5] }));
      mockedEnsureValidToken.mockResolvedValue({ accessToken: 'jira-token', cloudId: 'cloud-1', siteUrl: 'https://jira.example.com' });
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('skip'));

      const mockGetRecentlyUpdated = jest.fn().mockResolvedValue([]);
      MockedJiraService.mockImplementation(() => ({
        getRecentlyUpdatedIssues: mockGetRecentlyUpdated,
        getCurrentSprintIssues: jest.fn().mockResolvedValue([]),
        getCurrentUser: jest.fn(),
        getIssue: jest.fn(),
      }) as unknown as JiraService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      await generator.generate('U12345', undefined, wednesday);

      // Should have called with Monday 2026-03-09 (skips Tuesday)
      expect(mockGetRecentlyUpdated).toHaveBeenCalledWith('jira-acct-1', '2026-03-09');
    });

    it('uses Monday as yesterday for regular Tuesday standup', async () => {
      const tuesday = new Date('2026-03-10T10:00:00Z');

      const { tokenService, standupService, userService, slackService } = makeMocks();
      (userService.getBySlackId as jest.Mock).mockResolvedValue(makeUser());
      mockedEnsureValidToken.mockResolvedValue({ accessToken: 'jira-token', cloudId: 'cloud-1', siteUrl: 'https://jira.example.com' });
      mockedEnsureValidGoogleToken.mockRejectedValue(new Error('skip'));

      const mockGetRecentlyUpdated = jest.fn().mockResolvedValue([]);
      MockedJiraService.mockImplementation(() => ({
        getRecentlyUpdatedIssues: mockGetRecentlyUpdated,
        getCurrentSprintIssues: jest.fn().mockResolvedValue([]),
        getCurrentUser: jest.fn(),
        getIssue: jest.fn(),
      }) as unknown as JiraService);

      const generator = new StandupGeneratorService(tokenService, standupService, userService, slackService, jiraConfig, googleConfig);
      await generator.generate('U12345', undefined, tuesday);

      // Should have called with Monday 2026-03-09
      expect(mockGetRecentlyUpdated).toHaveBeenCalledWith('jira-acct-1', '2026-03-09');
    });
  });
});
