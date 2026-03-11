import { StandupSchedulerService, getReminderTime, getWeekStartDate } from '../src/services/standup-scheduler.service';
import { SlackService } from '../src/services/slack.service';
import { UserService } from '../src/services/user.service';
import { StandupService } from '../src/services/standup.service';
import { StandupGeneratorService } from '../src/services/standup-generator.service';
import { AIService } from '../src/services/ai.service';
import { User } from '../src/models';

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
    googleConnected: false,
    defaultChannelId: 'C123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMocks() {
  const userService = {
    getEnabledUsers: jest.fn().mockResolvedValue([]),
    getBySlackId: jest.fn(),
  } as unknown as UserService;

  const standupService = {
    getById: jest.fn().mockResolvedValue(null),
    getByDateRange: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  } as unknown as StandupService;

  const generatorService = {
    generate: jest.fn().mockResolvedValue({ record: {}, posted: true }),
  } as unknown as StandupGeneratorService;

  return { userService, standupService, generatorService };
}

describe('StandupSchedulerService', () => {
  describe('tick()', () => {
    it('triggers standup for user whose time has arrived', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      // Tuesday 2026-03-10 at 09:00 UTC
      const now = new Date('2026-03-10T09:00:30Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).toHaveBeenCalledWith('U12345', 'C123', now);
    });

    it('skips user whose time has not arrived', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      // Tuesday 2026-03-10 at 10:00 UTC — user is configured for 09:00
      const now = new Date('2026-03-10T10:00:00Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).not.toHaveBeenCalled();
    });

    it('skips user on a non-standup day', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      // Saturday 2026-03-14 at 09:00 UTC — user configured Mon-Fri
      const now = new Date('2026-03-14T09:00:00Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).not.toHaveBeenCalled();
    });

    it('handles timezone correctly (09:00 ET = 13:00 UTC in March)', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const user = makeUser({
        slackUserId: 'U_ET',
        timezone: 'America/New_York',
        standupTime: '09:00',
      });
      // 13:00 UTC = 09:00 EDT (March, DST active)
      const now = new Date('2026-03-10T13:00:30Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).toHaveBeenCalledWith('U_ET', 'C123', now);
    });

    it('skips if standup already exists for today (dedup)', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const now = new Date('2026-03-10T09:00:00Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);
      (standupService.getById as jest.Mock).mockResolvedValue({ userId: 'U12345', date: '2026-03-10' });

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).not.toHaveBeenCalled();
    });

    it('isolates errors — one user fails, second still triggers', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const now = new Date('2026-03-10T09:00:00Z');
      const user1 = makeUser({ slackUserId: 'U_FAIL' });
      const user2 = makeUser({ slackUserId: 'U_OK' });
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user1, user2]);
      (generatorService.generate as jest.Mock)
        .mockRejectedValueOnce(new Error('Jira exploded'))
        .mockResolvedValueOnce({ record: {}, posted: true });

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).toHaveBeenCalledTimes(2);
      expect(generatorService.generate).toHaveBeenCalledWith('U_FAIL', 'C123', now);
      expect(generatorService.generate).toHaveBeenCalledWith('U_OK', 'C123', now);
    });

    it('passes user.defaultChannelId to generate()', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const now = new Date('2026-03-10T09:00:00Z');
      const user = makeUser({ defaultChannelId: 'C_CUSTOM' });
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).toHaveBeenCalledWith('U12345', 'C_CUSTOM', now);
    });

    it('returns cleanly when no users are enabled', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const now = new Date('2026-03-10T09:00:00Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([]);

      const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
      await scheduler.tick(now);

      expect(generatorService.generate).not.toHaveBeenCalled();
      expect(standupService.getById).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentTimeInTimezone()', () => {
    it('returns correct time and day for UTC', () => {
      const scheduler = new StandupSchedulerService(
        {} as UserService,
        {} as StandupService,
        {} as StandupGeneratorService,
      );

      // Tuesday 2026-03-10 at 09:15 UTC
      const now = new Date('2026-03-10T09:15:00Z');
      const result = scheduler.getCurrentTimeInTimezone('UTC', now);

      expect(result.time).toBe('09:15');
      expect(result.dayOfWeek).toBe(2); // Tuesday
      expect(result.dateStr).toBe('2026-03-10');
    });

    it('returns correct time for America/New_York (EDT)', () => {
      const scheduler = new StandupSchedulerService(
        {} as UserService,
        {} as StandupService,
        {} as StandupGeneratorService,
      );

      // 14:00 UTC = 10:00 EDT in March
      const now = new Date('2026-03-10T14:00:00Z');
      const result = scheduler.getCurrentTimeInTimezone('America/New_York', now);

      expect(result.time).toBe('10:00');
      expect(result.dateStr).toBe('2026-03-10');
    });

    it('returns correct date near midnight with timezone offset', () => {
      const scheduler = new StandupSchedulerService(
        {} as UserService,
        {} as StandupService,
        {} as StandupGeneratorService,
      );

      // 2026-03-11 02:00 UTC = 2026-03-10 21:00 in America/New_York
      const now = new Date('2026-03-11T02:00:00Z');
      const result = scheduler.getCurrentTimeInTimezone('America/New_York', now);

      expect(result.dateStr).toBe('2026-03-10');
      expect(result.time).toBe('22:00');
    });
  });

  describe('reminders', () => {
    it('sends reminder 15 minutes before standup', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const slackService = {
        postMessage: jest.fn().mockResolvedValue({}),
      } as unknown as SlackService;

      // User standup at 09:00, current time 08:45 UTC on Tuesday
      const now = new Date('2026-03-10T08:45:30Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);

      const scheduler = new StandupSchedulerService(
        userService, standupService, generatorService, slackService,
      );
      await scheduler.tick(now);

      expect(slackService.postMessage).toHaveBeenCalledWith(
        'U12345',
        [],
        expect.stringContaining('15 minutes'),
      );
      // Should NOT trigger standup generation (not standup time yet)
      expect(generatorService.generate).not.toHaveBeenCalled();
    });

    it('does not send reminder if standup already exists', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const slackService = {
        postMessage: jest.fn().mockResolvedValue({}),
      } as unknown as SlackService;

      const now = new Date('2026-03-10T08:45:00Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);
      (standupService.getById as jest.Mock).mockResolvedValue({ userId: 'U12345' });

      const scheduler = new StandupSchedulerService(
        userService, standupService, generatorService, slackService,
      );
      await scheduler.tick(now);

      expect(slackService.postMessage).not.toHaveBeenCalled();
    });

    it('does not send reminder without slackService', async () => {
      const { userService, standupService, generatorService } = makeMocks();
      const now = new Date('2026-03-10T08:45:00Z');
      (userService.getEnabledUsers as jest.Mock).mockResolvedValue([makeUser()]);

      // No slackService passed
      const scheduler = new StandupSchedulerService(
        userService, standupService, generatorService,
      );
      await scheduler.tick(now);

      // Should not throw, just skip reminders
      expect(standupService.getById).not.toHaveBeenCalled();
    });
  });
});

describe('getReminderTime', () => {
  it('returns 15 minutes before standup time', () => {
    expect(getReminderTime('09:00')).toBe('08:45');
    expect(getReminderTime('10:30')).toBe('10:15');
    expect(getReminderTime('14:00')).toBe('13:45');
  });

  it('handles midnight boundary (wraps to previous day)', () => {
    expect(getReminderTime('00:00')).toBe('23:45');
    expect(getReminderTime('00:10')).toBe('23:55');
  });

  it('handles exact 15-minute mark', () => {
    expect(getReminderTime('00:15')).toBe('00:00');
  });
});

describe('getWeekStartDate', () => {
  it('returns Monday for a Monday date', () => {
    // 2026-03-09 is a Monday
    expect(getWeekStartDate('2026-03-09')).toBe('2026-03-09');
  });

  it('returns Monday for a Wednesday date', () => {
    // 2026-03-11 is a Wednesday
    expect(getWeekStartDate('2026-03-11')).toBe('2026-03-09');
  });

  it('returns Monday for a Friday date', () => {
    // 2026-03-13 is a Friday
    expect(getWeekStartDate('2026-03-13')).toBe('2026-03-09');
  });

  it('returns Monday for a Sunday date (previous Monday)', () => {
    // 2026-03-15 is a Sunday
    expect(getWeekStartDate('2026-03-15')).toBe('2026-03-09');
  });

  it('handles month boundary (Monday in previous month)', () => {
    // 2026-03-01 is a Sunday → Monday is 2026-02-23
    expect(getWeekStartDate('2026-03-01')).toBe('2026-02-23');
  });
});

describe('Weekly summary in scheduler', () => {
  it('sends weekly summary on last standup day', async () => {
    const { userService, standupService, generatorService } = makeMocks();
    const slackService = {
      postMessage: jest.fn().mockResolvedValue({}),
    } as unknown as SlackService;

    // User with Mon-Fri schedule, Friday is last day (5)
    const user = makeUser({ standupDays: [1, 2, 3, 4, 5] });
    // Friday 2026-03-13 at 09:00 UTC
    const now = new Date('2026-03-13T09:00:30Z');
    (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);
    (standupService.getByDateRange as jest.Mock).mockResolvedValue([
      { userId: 'U12345', date: '2026-03-09', yesterday: [], today: [], blockers: 'None', events: [] },
      { userId: 'U12345', date: '2026-03-13', yesterday: [], today: [], blockers: 'None', events: [] },
    ]);

    const scheduler = new StandupSchedulerService(
      userService, standupService, generatorService, slackService,
    );
    await scheduler.tick(now);

    // Standup should be generated
    expect(generatorService.generate).toHaveBeenCalledWith('U12345', 'C123', now);
    // Weekly summary should be sent
    expect(slackService.postMessage).toHaveBeenCalledWith(
      'C123',
      expect.arrayContaining([
        expect.objectContaining({ type: 'header' }),
      ]),
      expect.stringContaining('Weekly'),
    );
    // getByDateRange called with Monday to Friday
    expect(standupService.getByDateRange).toHaveBeenCalledWith(
      'U12345', '2026-03-09', '2026-03-13',
    );
  });

  it('does not send weekly summary on non-last standup day', async () => {
    const { userService, standupService, generatorService } = makeMocks();
    const slackService = {
      postMessage: jest.fn().mockResolvedValue({}),
    } as unknown as SlackService;

    const user = makeUser({ standupDays: [1, 2, 3, 4, 5] });
    // Wednesday 2026-03-11 at 09:00 UTC — not last day (Friday)
    const now = new Date('2026-03-11T09:00:30Z');
    (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);

    const scheduler = new StandupSchedulerService(
      userService, standupService, generatorService, slackService,
    );
    await scheduler.tick(now);

    // Standup generated but no weekly summary
    expect(generatorService.generate).toHaveBeenCalled();
    expect(standupService.getByDateRange).not.toHaveBeenCalled();
  });

  it('does not send weekly summary without slackService', async () => {
    const { userService, standupService, generatorService } = makeMocks();

    const user = makeUser({ standupDays: [1, 2, 3, 4, 5] });
    // Friday 2026-03-13 at 09:00 UTC
    const now = new Date('2026-03-13T09:00:30Z');
    (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);

    const scheduler = new StandupSchedulerService(
      userService, standupService, generatorService,
    );
    await scheduler.tick(now);

    expect(generatorService.generate).toHaveBeenCalled();
    expect(standupService.getByDateRange).not.toHaveBeenCalled();
  });

  it('includes AI blocker summary in weekly summary when configured', async () => {
    const { userService, standupService, generatorService } = makeMocks();
    const slackService = {
      postMessage: jest.fn().mockResolvedValue({}),
    } as unknown as SlackService;
    const aiService = {
      isConfigured: true,
      summarizeBlockers: jest.fn().mockResolvedValue('Recurring deploy dependency — escalate to DevOps.'),
    } as unknown as AIService;

    const user = makeUser({ standupDays: [1, 2, 3, 4, 5] });
    const now = new Date('2026-03-13T09:00:30Z');
    (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);
    (standupService.getByDateRange as jest.Mock).mockResolvedValue([
      { userId: 'U12345', date: '2026-03-10', yesterday: [], today: [], blockers: 'Waiting on deploy', events: [] },
      { userId: 'U12345', date: '2026-03-11', yesterday: [], today: [], blockers: 'None', events: [] },
    ]);

    const scheduler = new StandupSchedulerService(
      userService, standupService, generatorService, slackService, aiService,
    );
    await scheduler.tick(now);

    // AI service called with only the blocker entries (not 'None')
    expect(aiService.summarizeBlockers).toHaveBeenCalledWith([
      { date: '2026-03-10', text: 'Waiting on deploy' },
    ]);

    // Weekly summary includes AI analysis
    const postCall = (slackService.postMessage as jest.Mock).mock.calls.find(
      (call: any[]) => call[2] === 'Weekly standup summary',
    );
    expect(postCall).toBeDefined();
    const blocks = postCall[1];
    const allText = blocks.map((b: any) => b.text?.text || '').join('\n');
    expect(allText).toContain('AI Analysis');
    expect(allText).toContain('Recurring deploy dependency');
  });

  it('gracefully handles AI service failure', async () => {
    const { userService, standupService, generatorService } = makeMocks();
    const slackService = {
      postMessage: jest.fn().mockResolvedValue({}),
    } as unknown as SlackService;
    const aiService = {
      isConfigured: true,
      summarizeBlockers: jest.fn().mockRejectedValue(new Error('API rate limit')),
    } as unknown as AIService;

    const user = makeUser({ standupDays: [1, 2, 3, 4, 5] });
    const now = new Date('2026-03-13T09:00:30Z');
    (userService.getEnabledUsers as jest.Mock).mockResolvedValue([user]);
    (standupService.getByDateRange as jest.Mock).mockResolvedValue([
      { userId: 'U12345', date: '2026-03-10', yesterday: [], today: [], blockers: 'Blocked', events: [] },
    ]);

    const scheduler = new StandupSchedulerService(
      userService, standupService, generatorService, slackService, aiService,
    );
    await scheduler.tick(now);

    // Weekly summary still sent (without AI section)
    expect(slackService.postMessage).toHaveBeenCalledWith(
      'C123',
      expect.any(Array),
      'Weekly standup summary',
    );
    const postCall = (slackService.postMessage as jest.Mock).mock.calls.find(
      (call: any[]) => call[2] === 'Weekly standup summary',
    );
    const blocks = postCall[1];
    const allText = blocks.map((b: any) => b.text?.text || '').join('\n');
    expect(allText).not.toContain('AI Analysis');
  });
});
