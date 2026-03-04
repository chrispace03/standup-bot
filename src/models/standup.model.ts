export interface JiraIssueReference {
  issueKey: string;
  summary: string;
  status: string;
  issueType: string;
  url: string;
}

export interface CalendarEventReference {
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
}

export interface StandupRecord {
  userId: string;
  date: string;
  yesterday: JiraIssueReference[];
  today: JiraIssueReference[];
  blockers: string;
  events: CalendarEventReference[];
  postedAt?: Date;
  slackChannelId?: string;
  slackMessageTs?: string;
}
