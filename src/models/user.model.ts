export interface User {
  slackUserId: string;
  slackTeamId: string;
  displayName: string;
  email: string;
  timezone: string;
  standupTime: string;
  standupEnabled: boolean;
  standupDays: number[];
  defaultChannelId?: string;
  jiraAccountId?: string;
  googleConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}
