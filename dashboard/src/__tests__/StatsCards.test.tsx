import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsCards } from '../components/StatsCards';
import type { DashboardStats } from '../api';

const mockStats: DashboardStats = {
  totalUsers: 8,
  activeUsers: 5,
  standupsToday: 3,
  standupsThisWeek: 18,
  blockersThisWeek: 2,
  issuesCompleted: 24,
  issuesPlanned: 15,
  meetingsThisWeek: 10,
  userActivity: [],
};

describe('StatsCards', () => {
  it('renders all stat cards with correct values', () => {
    render(<StatsCards stats={mockStats} />);

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Standups Today')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Blockers This Week')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Issues Completed')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });
});
