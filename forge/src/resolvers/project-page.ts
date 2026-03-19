import Resolver from '@forge/resolver';
import { backendGet } from '../utils/api-client';

interface UserActivity {
  userId: string;
  displayName: string;
  standupsThisWeek: number;
  hasBlockers: boolean;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  standupsToday: number;
  standupsThisWeek: number;
  blockersThisWeek: number;
  issuesCompleted: number;
  issuesPlanned: number;
  meetingsThisWeek: number;
  userActivity: UserActivity[];
}

interface StandupRecord {
  userId: string;
  date: string;
  yesterday: { issueKey: string; summary: string }[];
  today: { issueKey: string; summary: string }[];
  blockers: string;
}

interface StandupsResponse {
  records: StandupRecord[];
}

const resolver = new Resolver();

resolver.define('project-page-resolver', async () => {
  const [statsResult, standupsResult] = await Promise.all([
    backendGet<DashboardStats>('/dashboard/stats'),
    backendGet<StandupsResponse>('/dashboard/standups?limit=20'),
  ]);

  if (statsResult.error || standupsResult.error) {
    return {
      stats: null,
      standups: [],
      error: statsResult.error || standupsResult.error,
    };
  }

  return {
    stats: statsResult.data,
    standups: standupsResult.data?.records || [],
    error: null,
  };
});

export const handler = resolver.getDefinitions();
