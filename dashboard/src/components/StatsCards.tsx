import type { DashboardStats } from '../api';

interface Props {
  stats: DashboardStats;
}

function Card({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${accent ? 'text-purple-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="Total Users" value={stats.totalUsers} />
      <Card label="Active Users" value={stats.activeUsers} accent />
      <Card label="Standups Today" value={stats.standupsToday} />
      <Card label="Standups This Week" value={stats.standupsThisWeek} accent />
      <Card label="Blockers This Week" value={stats.blockersThisWeek} />
      <Card label="Issues Completed" value={stats.issuesCompleted} />
      <Card label="Issues Planned" value={stats.issuesPlanned} />
      <Card label="Meetings" value={stats.meetingsThisWeek} />
    </div>
  );
}
