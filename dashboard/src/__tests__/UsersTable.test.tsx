import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UsersTable } from '../components/UsersTable';
import type { User } from '../api';

const mockUsers: User[] = [
  {
    slackUserId: 'U1',
    slackTeamId: 'T1',
    displayName: 'Alice',
    email: 'alice@example.com',
    timezone: 'America/New_York',
    standupTime: '09:00',
    standupEnabled: true,
    standupDays: [1, 2, 3, 4, 5],
    googleConnected: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-03-01',
  },
  {
    slackUserId: 'U2',
    slackTeamId: 'T1',
    displayName: 'Bob',
    email: 'bob@example.com',
    timezone: 'UTC',
    standupTime: '10:00',
    standupEnabled: false,
    standupDays: [1, 3, 5],
    googleConnected: false,
    createdAt: '2026-01-15',
    updatedAt: '2026-03-01',
  },
];

describe('UsersTable', () => {
  it('renders user rows with correct data', () => {
    render(<UsersTable users={mockUsers} onSelect={() => {}} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('shows empty state when no users', () => {
    render(<UsersTable users={[]} onSelect={() => {}} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('calls onSelect with userId when row is clicked', () => {
    const onSelect = vi.fn();
    render(<UsersTable users={mockUsers} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Alice'));
    expect(onSelect).toHaveBeenCalledWith('U1');
  });
});
