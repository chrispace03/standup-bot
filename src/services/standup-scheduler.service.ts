import cron, { ScheduledTask } from 'node-cron';
import { UserService } from './user.service';
import { StandupService } from './standup.service';
import { StandupGeneratorService } from './standup-generator.service';
import { SlackService } from './slack.service';
import { AIService } from './ai.service';
import { formatWeeklySummary } from '../utils/slack-formatter';

interface TimezoneInfo {
  time: string;       // "HH:MM"
  dayOfWeek: number;  // 0=Sun, 6=Sat
  dateStr: string;    // "YYYY-MM-DD"
}

export function getReminderTime(standupTime: string): string {
  const [h, m] = standupTime.split(':').map(Number);
  const totalMinutes = h * 60 + m - 15;
  if (totalMinutes < 0) {
    const wrapped = totalMinutes + 24 * 60;
    return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
  }
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

export function getWeekStartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export class StandupSchedulerService {
  private task: ScheduledTask | null = null;

  constructor(
    private userService: UserService,
    private standupService: StandupService,
    private generatorService: StandupGeneratorService,
    private slackService?: SlackService,
    private aiService?: AIService,
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
    let reminders = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const { time, dayOfWeek, dateStr } = this.getCurrentTimeInTimezone(user.timezone, now);

        // Skip if not a standup day
        if (!user.standupDays.includes(dayOfWeek)) continue;

        // Check for reminder (15 min before standup)
        const reminderTime = getReminderTime(user.standupTime);
        if (time === reminderTime && this.slackService) {
          const existing = await this.standupService.getById(dateStr, user.slackUserId);
          if (!existing) {
            await this.slackService.postMessage(
              user.slackUserId,
              [],
              `Heads up! Your standup is in 15 minutes (${user.standupTime}). Use /standup if you'd like to generate it early.`,
            );
            reminders++;
          }
        }

        // Check if it's time for standup generation
        if (time !== user.standupTime) continue;

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

        // Weekly summary: send on the last standup day of the week
        const lastStandupDay = Math.max(...user.standupDays);
        if (dayOfWeek === lastStandupDay && this.slackService) {
          const weekStart = getWeekStartDate(dateStr);
          const records = await this.standupService.getByDateRange(
            user.slackUserId, weekStart, dateStr,
          );

          // AI blocker analysis
          let aiSummary: string | null = null;
          if (this.aiService?.isConfigured) {
            const blockerEntries = records
              .filter((r) => r.blockers && r.blockers !== 'None')
              .map((r) => ({ date: r.date, text: r.blockers }));
            try {
              aiSummary = await this.aiService.summarizeBlockers(blockerEntries);
            } catch (err) {
              console.warn(`[SCHEDULER] AI summary failed for ${user.slackUserId}:`, err);
            }
          }

          const blocks = formatWeeklySummary(
            records, user.displayName, weekStart, dateStr, aiSummary,
          );
          const channel = user.defaultChannelId || user.slackUserId;
          await this.slackService.postMessage(channel, blocks, 'Weekly standup summary');
        }
      } catch (err) {
        errors++;
        console.error(`[SCHEDULER] Failed for ${user.slackUserId}:`, err);
      }
    }

    if (users.length > 0) {
      console.log(`[SCHEDULER] Tick complete: ${users.length} checked, ${triggered} triggered, ${reminders} reminders, ${errors} errors`);
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
