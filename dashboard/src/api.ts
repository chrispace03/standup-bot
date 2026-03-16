const BASE = '/api';

export interface User {
  slackUserId: string;
  slackTeamId: string;
  displayName: string;
  email: string;
  timezone: string;
  standupTime: string;
  standupEnabled: boolean;
  standupDays: number[];
  googleConnected: boolean;
  defaultChannelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StandupRecord {
  userId: string;
  date: string;
  yesterday: { issueKey: string; summary: string; status: string; url: string }[];
  today: { issueKey: string; summary: string; status: string; url: string }[];
  blockers: string;
  events: { title: string; startTime: string; endTime: string }[];
  postedAt?: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  standupsToday: number;
  standupsThisWeek: number;
  blockersThisWeek: number;
  issuesCompleted: number;
  issuesPlanned: number;
  meetingsThisWeek: number;
  userActivity: {
    userId: string;
    displayName: string;
    standupsThisWeek: number;
    hasBlockers: boolean;
  }[];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getUsers: () => fetchJSON<{ users: User[] }>(`${BASE}/dashboard/users`),
  getStats: () => fetchJSON<DashboardStats>(`${BASE}/dashboard/stats`),
  getStandups: (limit = 50) =>
    fetchJSON<{ records: StandupRecord[] }>(`${BASE}/dashboard/standups?limit=${limit}`),
  getUserHistory: (userId: string, limit = 14) =>
    fetchJSON<{ records: StandupRecord[] }>(
      `${BASE}/standup/history?userId=${userId}&limit=${limit}`,
    ),
};
