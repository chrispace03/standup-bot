import { JiraConfig, GoogleConfig } from '../config';
import { AppError } from '../middleware';
import {
  StandupRecord,
  JiraIssueReference,
  CalendarEventReference,
  User,
} from '../models';
import {
  ensureValidToken,
  ensureValidGoogleToken,
  formatStandupMessage,
} from '../utils';
import { TokenService } from './token.service';
import { StandupService } from './standup.service';
import { UserService } from './user.service';
import { SlackService } from './slack.service';
import { JiraService } from './jira.service';
import { GoogleCalendarService } from './google-calendar.service';

export interface GenerateResult {
  record: StandupRecord;
  posted: boolean;
}

export class StandupGeneratorService {
  constructor(
    private tokenService: TokenService,
    private standupService: StandupService,
    private userService: UserService,
    private slackService: SlackService,
    private jiraConfig: JiraConfig,
    private googleConfig: GoogleConfig,
  ) {}

  async generate(slackUserId: string, channelId?: string, now: Date = new Date()): Promise<GenerateResult> {
    const user = await this.userService.getBySlackId(slackUserId);
    if (!user) {
      throw new AppError('User not registered', 404);
    }

    const todayStr = this.getTodayStr(user.timezone, now);

    const [yesterday, today, events] = await Promise.all([
      this.fetchYesterday(slackUserId, user, todayStr),
      this.fetchToday(slackUserId, user),
      this.fetchEvents(slackUserId, todayStr, user.timezone),
    ]);

    const record: StandupRecord = {
      userId: slackUserId,
      date: todayStr,
      yesterday,
      today,
      blockers: '',
      events,
    };

    await this.standupService.save(record);

    let posted = false;
    if (channelId) {
      const blocks = formatStandupMessage(record, user.displayName);
      const result = await this.slackService.postMessage(
        channelId,
        blocks,
        `Standup for ${user.displayName}`,
      );

      record.postedAt = new Date();
      record.slackChannelId = channelId;
      record.slackMessageTs = result.ts as string;
      await this.standupService.save(record);
      posted = true;
    }

    return { record, posted };
  }

  private async fetchYesterday(
    slackUserId: string,
    user: User,
    todayStr: string,
  ): Promise<JiraIssueReference[]> {
    try {
      if (!user.jiraAccountId) return [];

      const { accessToken, cloudId, siteUrl } = await ensureValidToken(
        slackUserId,
        this.tokenService,
        this.jiraConfig,
      );

      const lastWorkingDay = this.getLastWorkingDay(
        new Date(todayStr + 'T12:00:00Z'),
        user.standupDays,
      );

      const jira = new JiraService(accessToken, cloudId, siteUrl);
      return await jira.getRecentlyUpdatedIssues(user.jiraAccountId, lastWorkingDay);
    } catch (err) {
      console.warn(`[STANDUP] Failed to fetch yesterday's issues for ${slackUserId}:`, err);
      return [];
    }
  }

  private async fetchToday(
    slackUserId: string,
    user: User,
  ): Promise<JiraIssueReference[]> {
    try {
      if (!user.jiraAccountId) return [];

      const { accessToken, cloudId, siteUrl } = await ensureValidToken(
        slackUserId,
        this.tokenService,
        this.jiraConfig,
      );

      const jira = new JiraService(accessToken, cloudId, siteUrl);
      return await jira.getCurrentSprintIssues(user.jiraAccountId);
    } catch (err) {
      console.warn(`[STANDUP] Failed to fetch today's issues for ${slackUserId}:`, err);
      return [];
    }
  }

  private async fetchEvents(
    slackUserId: string,
    todayStr: string,
    timezone: string,
  ): Promise<CalendarEventReference[]> {
    try {
      const accessToken = await ensureValidGoogleToken(
        slackUserId,
        this.tokenService,
        this.googleConfig,
      );

      const calendar = new GoogleCalendarService(accessToken);
      return await calendar.getTodayEvents(todayStr, timezone);
    } catch (err) {
      console.warn(`[STANDUP] Failed to fetch calendar events for ${slackUserId}:`, err);
      return [];
    }
  }

  private getLastWorkingDay(today: Date, standupDays: number[]): string {
    const d = new Date(today);
    for (let i = 0; i < 7; i++) {
      d.setUTCDate(d.getUTCDate() - 1);
      if (standupDays.includes(d.getUTCDay())) {
        return d.toISOString().slice(0, 10);
      }
    }
    // Fallback: yesterday
    const fallback = new Date(today);
    fallback.setUTCDate(fallback.getUTCDate() - 1);
    return fallback.toISOString().slice(0, 10);
  }

  private getTodayStr(timezone: string, now: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  }
}
