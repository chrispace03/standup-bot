import cron, { ScheduledTask } from 'node-cron';
import { UserService } from './user.service';
import { StandupService } from './standup.service';
import { StandupGeneratorService } from './standup-generator.service';

interface TimezoneInfo {
  time: string;       // "HH:MM"
  dayOfWeek: number;  // 0=Sun, 6=Sat
  dateStr: string;    // "YYYY-MM-DD"
}

export class StandupSchedulerService {
  private task: ScheduledTask | null = null;

  constructor(
    private userService: UserService,
    private standupService: StandupService,
    private generatorService: StandupGeneratorService,
  ) {}

  start(): void {
    this.task = cron.schedule('* * * * *', () => {
      this.tick().catch((err) => {
        console.error('[SCHEDULER] Tick failed:', err);
      });
    });
    console.log('[SCHEDULER] Started (every minute)');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[SCHEDULER] Stopped');
    }
  }

  async tick(now: Date = new Date()): Promise<void> {
    const users = await this.userService.getEnabledUsers();

    let triggered = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const { time, dayOfWeek, dateStr } = this.getCurrentTimeInTimezone(user.timezone, now);

        // Check if it's time for this user's standup
        if (time !== user.standupTime) continue;
        if (!user.standupDays.includes(dayOfWeek)) continue;

        // Dedup: skip if standup already exists for today
        const existing = await this.standupService.getById(dateStr, user.slackUserId);
        if (existing) continue;

        // Generate and post standup
        await this.generatorService.generate(
          user.slackUserId,
          user.defaultChannelId,
          now,
        );
        triggered++;
        console.log(`[SCHEDULER] Triggered standup for ${user.slackUserId}`);
      } catch (err) {
        errors++;
        console.error(`[SCHEDULER] Failed for ${user.slackUserId}:`, err);
      }
    }

    if (users.length > 0) {
      console.log(`[SCHEDULER] Tick complete: ${users.length} checked, ${triggered} triggered, ${errors} errors`);
    }
  }

  getCurrentTimeInTimezone(timezone: string, now: Date): TimezoneInfo {
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = dateFormatter.format(now);

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const time = timeFormatter.format(now);

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    const dayStr = dayFormatter.format(now);
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayOfWeek = dayMap[dayStr] ?? 0;

    return { time, dayOfWeek, dateStr };
  }
}
