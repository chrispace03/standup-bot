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

export function formatConnectionStatus(tokens: UserTokens | null): KnownBlock[] {
  const slack = tokens?.slack ? 'Connected' : 'Not connected';
  const jira = tokens?.jira ? 'Connected' : 'Not connected';
  const google = tokens?.google ? 'Connected' : 'Not connected';

  return [
    header('Service Connections'),
    divider(),
    section(
      `*Slack:* ${slack}\n` +
      `*Jira:* ${jira}\n` +
      `*Google Calendar:* ${google}`
    ),
  ];
}
