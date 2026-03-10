import { StandupSchedulerService } from '../src/services/standup-scheduler.service';
import { UserService } from '../src/services/user.service';
import { StandupService } from '../src/services/standup.service';
import { StandupGeneratorService } from '../src/services/standup-generator.service';
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
});
