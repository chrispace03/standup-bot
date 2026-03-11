import { KnownBlock, SectionBlock, DividerBlock, HeaderBlock } from '@slack/web-api';
import { StandupRecord, User, UserTokens } from '../models';

function header(text: string): HeaderBlock {
  return {
    type: 'header',
    text: { type: 'plain_text', text, emoji: true },
  };
}

function section(text: string): SectionBlock {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text },
  };
}

function divider(): DividerBlock {
  return { type: 'divider' };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatStandupMessage(
  record: StandupRecord,
  displayName: string
): KnownBlock[] {
  const blocks: KnownBlock[] = [];

  blocks.push(header(`${displayName}'s Standup - ${formatDate(record.date)}`));
  blocks.push(divider());

  // Yesterday
  if (record.yesterday.length > 0) {
    const items = record.yesterday
      .map((issue) => `  • <${issue.url}|${issue.issueKey}>: ${issue.summary}`)
      .join('\n');
    blocks.push(section(`*Yesterday:*\n${items}`));
  } else {
    blocks.push(section('*Yesterday:*\n  _No completed items_'));
  }

  // Today
  if (record.today.length > 0) {
    const items = record.today
      .map((issue) => `  • <${issue.url}|${issue.issueKey}>: ${issue.summary}`)
      .join('\n');
    blocks.push(section(`*Today:*\n${items}`));
  } else {
    blocks.push(section('*Today:*\n  _No planned items_'));
  }

  // Blockers
  blocks.push(
    section(`*Blockers:* ${record.blockers || 'None'}`)
  );

  // Events
  if (record.events.length > 0) {
    const items = record.events
      .map((event) => `  • ${formatTime(event.startTime)} - ${event.title}`)
      .join('\n');
    blocks.push(section(`*Events:*\n${items}`));
  }

  // Action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Regenerate' },
        action_id: 'regenerate_standup',
        value: JSON.stringify({ userId: record.userId, date: record.date }),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Edit Blockers' },
        action_id: 'edit_standup',
        value: JSON.stringify({ userId: record.userId, date: record.date }),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Skip Today' },
        action_id: 'skip_standup',
        style: 'danger',
        value: JSON.stringify({ userId: record.userId, date: record.date }),
      },
    ],
  } as KnownBlock);

  return blocks;
}

export function formatSettingsMessage(user: User): KnownBlock[] {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = user.standupDays.map((d) => dayNames[d]).join(', ');

  return [
    header('Standup Settings'),
    divider(),
    section(
      `*Time:* ${user.standupTime}\n` +
      `*Days:* ${days}\n` +
      `*Enabled:* ${user.standupEnabled ? 'Yes' : 'No'}\n` +
      `*Timezone:* ${user.timezone}\n` +
      (user.defaultChannelId ? `*Channel:* <#${user.defaultChannelId}>` : '*Channel:* Not set')
    ),
  ];
}

export function formatStandupHistory(
  records: StandupRecord[],
  displayName: string,
): KnownBlock[] {
  if (records.length === 0) {
    return [
      header('Standup History'),
      divider(),
      section('_No standups found. Use /standup to generate your first one._'),
    ];
  }

  const blocks: KnownBlock[] = [
    header(`${displayName}'s Standup History`),
    divider(),
  ];

  for (const record of records) {
    const yesterdayCount = record.yesterday.length;
    const todayCount = record.today.length;
    const eventCount = record.events.length;
    const hasBlockers = record.blockers && record.blockers !== 'None';

    let summary = `*${formatDate(record.date)}*\n`;
    summary += `  ${yesterdayCount} completed | ${todayCount} planned | ${eventCount} events`;
    if (hasBlockers) {
      summary += ' | :warning: blockers';
    }

    blocks.push(section(summary));
  }

  blocks.push(divider());
  blocks.push(
    section(`_Showing ${records.length} most recent standup${records.length === 1 ? '' : 's'}_`),
  );

  return blocks;
}

export function formatWeeklySummary(
  records: StandupRecord[],
  displayName: string,
  weekStart: string,
  weekEnd: string,
  aiSummary?: string | null,
): KnownBlock[] {
  if (records.length === 0) {
    return [
      header('Weekly Summary'),
      divider(),
      section(`_No standups recorded for ${formatDate(weekStart)} – ${formatDate(weekEnd)}._`),
    ];
  }

  const totalCompleted = records.reduce((sum, r) => sum + r.yesterday.length, 0);
  const totalPlanned = records.reduce((sum, r) => sum + r.today.length, 0);
  const totalEvents = records.reduce((sum, r) => sum + r.events.length, 0);
  const daysWithBlockers = records.filter(
    (r) => r.blockers && r.blockers !== 'None',
  ).length;

  const blocks: KnownBlock[] = [
    header(`${displayName}'s Weekly Summary`),
    section(`_${formatDate(weekStart)} – ${formatDate(weekEnd)}_`),
    divider(),
    section(
      `*Standups completed:* ${records.length}\n` +
      `*Issues completed:* ${totalCompleted}\n` +
      `*Issues planned:* ${totalPlanned}\n` +
      `*Meetings attended:* ${totalEvents}\n` +
      `*Days with blockers:* ${daysWithBlockers}`,
    ),
  ];

  const blockerDays = records.filter(
    (r) => r.blockers && r.blockers !== 'None',
  );
  if (blockerDays.length > 0) {
    const blockerLines = blockerDays
      .map((r) => `  • *${formatDate(r.date)}:* ${r.blockers}`)
      .join('\n');
    blocks.push(divider());
    blocks.push(section(`*Blockers this week:*\n${blockerLines}`));
  }

  if (aiSummary) {
    blocks.push(divider());
    blocks.push(section(`*AI Analysis:*\n${aiSummary}`));
  }

  return blocks;
}

export function formatConnectionStatus(
  tokens: UserTokens | null,
  baseUrl?: string,
  slackUserId?: string,
): KnownBlock[] {
  const slack = tokens?.slack ? 'Connected' : 'Not connected';
  const jira = tokens?.jira ? 'Connected' : 'Not connected';
  const google = tokens?.google ? 'Connected' : 'Not connected';

  const blocks: KnownBlock[] = [
    header('Service Connections'),
    divider(),
    section(
      `*Slack:* ${slack}\n` +
      `*Jira:* ${jira}\n` +
      `*Google Calendar:* ${google}`
    ),
  ];

  if (baseUrl && slackUserId) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Connect Jira' },
          url: `${baseUrl}/auth/jira?slackUserId=${slackUserId}`,
          action_id: 'connect_jira',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Connect Google Calendar' },
          url: `${baseUrl}/auth/google?slackUserId=${slackUserId}`,
          action_id: 'connect_google',
        },
      ],
    } as KnownBlock);
  }

  return blocks;
}
