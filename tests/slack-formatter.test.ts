import {
  formatStandupMessage,
  formatSettingsMessage,
  formatStandupHistory,
  formatWeeklySummary,
  formatConnectionStatus,
} from '../src/utils/slack-formatter';
import { StandupRecord, User, UserTokens } from '../src/models';

describe('formatStandupMessage', () => {
  const baseRecord: StandupRecord = {
    userId: 'U12345',
    date: '2026-03-09',
    yesterday: [
      {
        issueKey: 'PROJ-1',
        summary: 'Fix login bug',
        status: 'Done',
        issueType: 'Bug',
        url: 'https://jira.example.com/PROJ-1',
      },
    ],
    today: [
      {
        issueKey: 'PROJ-2',
        summary: 'Build API endpoint',
        status: 'In Progress',
        issueType: 'Story',
        url: 'https://jira.example.com/PROJ-2',
      },
    ],
    blockers: 'None',
    events: [
      {
        eventId: 'e1',
        title: 'Team Standup',
        startTime: new Date('2026-03-09T10:00:00'),
        endTime: new Date('2026-03-09T10:15:00'),
        isAllDay: false,
      },
    ],
  };

  it('produces Block Kit blocks with header, divider, and sections', () => {
    const blocks = formatStandupMessage(baseRecord, 'Chris');

    expect(blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: expect.stringContaining("Chris's Standup"), emoji: true },
    });
    expect(blocks[1]).toEqual({ type: 'divider' });

    // Yesterday section
    const yesterdayBlock = blocks[2] as { type: string; text: { text: string } };
    expect(yesterdayBlock.text.text).toContain('Yesterday');
    expect(yesterdayBlock.text.text).toContain('PROJ-1');

    // Today section
    const todayBlock = blocks[3] as { type: string; text: { text: string } };
    expect(todayBlock.text.text).toContain('Today');
    expect(todayBlock.text.text).toContain('PROJ-2');

    // Blockers section
    const blockersBlock = blocks[4] as { type: string; text: { text: string } };
    expect(blockersBlock.text.text).toContain('Blockers');
    expect(blockersBlock.text.text).toContain('None');

    // Events section
    const eventsBlock = blocks[5] as { type: string; text: { text: string } };
    expect(eventsBlock.text.text).toContain('Events');
    expect(eventsBlock.text.text).toContain('Team Standup');
  });

  it('handles empty yesterday and today arrays', () => {
    const emptyRecord: StandupRecord = {
      ...baseRecord,
      yesterday: [],
      today: [],
      events: [],
    };

    const blocks = formatStandupMessage(emptyRecord, 'Chris');

    const yesterdayBlock = blocks[2] as { type: string; text: { text: string } };
    expect(yesterdayBlock.text.text).toContain('No completed items');

    const todayBlock = blocks[3] as { type: string; text: { text: string } };
    expect(todayBlock.text.text).toContain('No planned items');

    // No events section when empty — still has actions block
    expect(blocks).toHaveLength(6); // header, divider, yesterday, today, blockers, actions
  });

  it('includes Jira issue links in markdown format', () => {
    const blocks = formatStandupMessage(baseRecord, 'Chris');

    const yesterdayBlock = blocks[2] as { type: string; text: { text: string } };
    expect(yesterdayBlock.text.text).toContain('<https://jira.example.com/PROJ-1|PROJ-1>');
  });

  it('includes action buttons (Regenerate, Edit Blockers, Skip Today)', () => {
    const blocks = formatStandupMessage(baseRecord, 'Chris');
    const actionsBlock = blocks[blocks.length - 1] as any;

    expect(actionsBlock.type).toBe('actions');
    expect(actionsBlock.elements).toHaveLength(3);
    expect(actionsBlock.elements[0].action_id).toBe('regenerate_standup');
    expect(actionsBlock.elements[1].action_id).toBe('edit_standup');
    expect(actionsBlock.elements[2].action_id).toBe('skip_standup');
    expect(actionsBlock.elements[2].style).toBe('danger');

    // Each button carries userId and date context
    const value = JSON.parse(actionsBlock.elements[0].value);
    expect(value.userId).toBe('U12345');
    expect(value.date).toBe('2026-03-09');
  });
});

describe('formatSettingsMessage', () => {
  it('formats user settings into Block Kit blocks', () => {
    const user: User = {
      slackUserId: 'U12345',
      slackTeamId: 'T12345',
      displayName: 'Chris',
      email: 'chris@example.com',
      timezone: 'Australia/Sydney',
      standupTime: '09:00',
      standupEnabled: true,
      standupDays: [1, 2, 3, 4, 5],
      googleConnected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const blocks = formatSettingsMessage(user);

    expect(blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: 'Standup Settings', emoji: true },
    });

    const settingsBlock = blocks[2] as { type: string; text: { text: string } };
    expect(settingsBlock.text.text).toContain('09:00');
    expect(settingsBlock.text.text).toContain('Mon, Tue, Wed, Thu, Fri');
    expect(settingsBlock.text.text).toContain('Yes');
    expect(settingsBlock.text.text).toContain('Australia/Sydney');
  });
});

describe('formatStandupHistory', () => {
  const records: StandupRecord[] = [
    {
      userId: 'U12345',
      date: '2026-03-12',
      yesterday: [
        { issueKey: 'P-1', summary: 'Task A', status: 'Done', issueType: 'Story', url: '' },
      ],
      today: [
        { issueKey: 'P-2', summary: 'Task B', status: 'In Progress', issueType: 'Story', url: '' },
        { issueKey: 'P-3', summary: 'Task C', status: 'To Do', issueType: 'Bug', url: '' },
      ],
      blockers: 'None',
      events: [
        { eventId: 'e1', title: 'Standup', startTime: new Date(), endTime: new Date(), isAllDay: false },
      ],
    },
    {
      userId: 'U12345',
      date: '2026-03-11',
      yesterday: [],
      today: [
        { issueKey: 'P-4', summary: 'Task D', status: 'In Progress', issueType: 'Story', url: '' },
      ],
      blockers: 'Waiting on API access',
      events: [],
    },
  ];

  it('shows header and summary for each record', () => {
    const blocks = formatStandupHistory(records, 'Chris');

    expect(blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: "Chris's Standup History", emoji: true },
    });
    expect(blocks[1]).toEqual({ type: 'divider' });

    // First record summary
    const first = blocks[2] as any;
    expect(first.text.text).toContain('1 completed');
    expect(first.text.text).toContain('2 planned');
    expect(first.text.text).toContain('1 events');

    // Second record with blockers
    const second = blocks[3] as any;
    expect(second.text.text).toContain('0 completed');
    expect(second.text.text).toContain(':warning: blockers');
  });

  it('shows footer with record count', () => {
    const blocks = formatStandupHistory(records, 'Chris');
    const footer = blocks[blocks.length - 1] as any;

    expect(footer.text.text).toContain('Showing 2 most recent standups');
  });

  it('shows empty state when no records', () => {
    const blocks = formatStandupHistory([], 'Chris');

    expect(blocks).toHaveLength(3); // header, divider, empty message
    const msg = blocks[2] as any;
    expect(msg.text.text).toContain('No standups found');
  });

  it('uses singular for single record', () => {
    const blocks = formatStandupHistory([records[0]], 'Chris');
    const footer = blocks[blocks.length - 1] as any;

    expect(footer.text.text).toContain('1 most recent standup');
    expect(footer.text.text).not.toContain('standups');
  });
});

describe('formatWeeklySummary', () => {
  const weekRecords: StandupRecord[] = [
    {
      userId: 'U12345', date: '2026-03-09',
      yesterday: [{ issueKey: 'P-1', summary: 'A', status: 'Done', issueType: 'Story', url: '' }],
      today: [{ issueKey: 'P-2', summary: 'B', status: 'In Progress', issueType: 'Story', url: '' }],
      blockers: 'None',
      events: [{ eventId: 'e1', title: 'Standup', startTime: new Date(), endTime: new Date(), isAllDay: false }],
    },
    {
      userId: 'U12345', date: '2026-03-10',
      yesterday: [{ issueKey: 'P-3', summary: 'C', status: 'Done', issueType: 'Bug', url: '' }],
      today: [],
      blockers: 'Waiting on deploy',
      events: [],
    },
  ];

  it('shows summary stats for the week', () => {
    const blocks = formatWeeklySummary(weekRecords, 'Chris', '2026-03-09', '2026-03-13');
    const statsBlock = blocks[3] as any;

    expect(statsBlock.text.text).toContain('Standups completed:* 2');
    expect(statsBlock.text.text).toContain('Issues completed:* 2');
    expect(statsBlock.text.text).toContain('Issues planned:* 1');
    expect(statsBlock.text.text).toContain('Meetings attended:* 1');
    expect(statsBlock.text.text).toContain('Days with blockers:* 1');
  });

  it('lists blocker details when present', () => {
    const blocks = formatWeeklySummary(weekRecords, 'Chris', '2026-03-09', '2026-03-13');
    const allText = blocks.map((b: any) => b.text?.text || '').join('\n');

    expect(allText).toContain('Waiting on deploy');
  });

  it('shows empty state when no records', () => {
    const blocks = formatWeeklySummary([], 'Chris', '2026-03-09', '2026-03-13');

    expect(blocks).toHaveLength(3);
    const msg = blocks[2] as any;
    expect(msg.text.text).toContain('No standups recorded');
  });

  it('includes AI analysis section when aiSummary is provided', () => {
    const blocks = formatWeeklySummary(
      weekRecords, 'Chris', '2026-03-09', '2026-03-13',
      'Deploy dependency is a recurring theme. Consider escalating to DevOps.',
    );
    const allText = blocks.map((b: any) => b.text?.text || '').join('\n');

    expect(allText).toContain('AI Analysis');
    expect(allText).toContain('Deploy dependency is a recurring theme');
  });

  it('omits AI analysis section when aiSummary is null', () => {
    const blocks = formatWeeklySummary(weekRecords, 'Chris', '2026-03-09', '2026-03-13', null);
    const allText = blocks.map((b: any) => b.text?.text || '').join('\n');

    expect(allText).not.toContain('AI Analysis');
  });
});

describe('formatConnectionStatus', () => {
  it('shows all services as not connected when tokens are null', () => {
    const blocks = formatConnectionStatus(null);

    const statusBlock = blocks[2] as { type: string; text: { text: string } };
    expect(statusBlock.text.text).toContain('Slack:* Not connected');
    expect(statusBlock.text.text).toContain('Jira:* Not connected');
    expect(statusBlock.text.text).toContain('Google Calendar:* Not connected');
  });

  it('shows connected services', () => {
    const tokens: UserTokens = {
      slackUserId: 'U12345',
      slack: {
        accessToken: 'xoxb-token',
        refreshToken: 'refresh',
        expiresAt: new Date(),
      },
      updatedAt: new Date(),
    };

    const blocks = formatConnectionStatus(tokens);

    const statusBlock = blocks[2] as { type: string; text: { text: string } };
    expect(statusBlock.text.text).toContain('Slack:* Connected');
    expect(statusBlock.text.text).toContain('Jira:* Not connected');
  });

  it('includes auth URL buttons when baseUrl and slackUserId are provided', () => {
    const blocks = formatConnectionStatus(null, 'https://example.com', 'U12345');
    const actionsBlock = blocks[blocks.length - 1] as any;

    expect(actionsBlock.type).toBe('actions');
    expect(actionsBlock.elements).toHaveLength(2);
    expect(actionsBlock.elements[0].action_id).toBe('connect_jira');
    expect(actionsBlock.elements[0].url).toBe('https://example.com/auth/jira?slackUserId=U12345');
    expect(actionsBlock.elements[1].action_id).toBe('connect_google');
    expect(actionsBlock.elements[1].url).toBe('https://example.com/auth/google?slackUserId=U12345');
  });

  it('omits auth buttons when baseUrl is not provided', () => {
    const blocks = formatConnectionStatus(null);

    expect(blocks).toHaveLength(3); // header, divider, status — no actions
  });
});
