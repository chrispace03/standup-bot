export interface Team {
  slackTeamId: string;
  teamName: string;
  defaultChannelId?: string;
  installedBy: string;
  installedAt: Date;
  settings: TeamSettings;
}

export interface TeamSettings {
  standupDays: number[];
  reminderEnabled: boolean;
}
