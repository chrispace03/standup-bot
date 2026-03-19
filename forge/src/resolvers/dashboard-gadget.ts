import Resolver from '@forge/resolver';
import { backendGet } from '../utils/api-client';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  standupsToday: number;
  standupsThisWeek: number;
  blockersThisWeek: number;
  issuesCompleted: number;
  issuesPlanned: number;
  meetingsThisWeek: number;
}

const resolver = new Resolver();

resolver.define('dashboard-gadget-resolver', async () => {
  const { data, error } = await backendGet<DashboardStats>('/dashboard/stats');

  if (error || !data) {
    return { stats: null, error: error || 'Failed to fetch stats' };
  }

  return { stats: data, error: null };
});

export const handler = resolver.getDefinitions();
