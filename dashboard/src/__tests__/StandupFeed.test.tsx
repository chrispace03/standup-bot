import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StandupFeed } from '../components/StandupFeed';
import type { StandupRecord } from '../api';

const mockRecords: StandupRecord[] = [
  {
    userId: 'U1',
    date: '2026-03-18',
    yesterday: [
      { issueKey: 'PROJ-1', summary: 'Fix login bug', status: 'Done', url: '' },
    ],
    today: [
      { issueKey: 'PROJ-2', summary: 'Build API endpoint', status: 'In Progress', url: '' },
    ],
    blockers: 'Waiting on API access',
    events: [],
  },
  {
    userId: 'U2',
    date: '2026-03-18',
    yesterday: [],
    today: [],
    blockers: 'None',
    events: [],
  },
];

const userNames: Record<string, string> = {
  U1: 'Alice',
  U2: 'Bob',
};

describe('StandupFeed', () => {
  it('renders standup records with user names', () => {
    render(<StandupFeed records={mockRecords} userNames={userNames} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays issue keys and summaries', () => {
    render(<StandupFeed records={mockRecords} userNames={userNames} />);

    expect(screen.getByText('PROJ-1')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    expect(screen.getByText('Build API endpoint')).toBeInTheDocument();
  });

  it('shows blocker badge when blockers exist', () => {
    render(<StandupFeed records={mockRecords} userNames={userNames} />);

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Waiting on API access')).toBeInTheDocument();
  });

  it('shows empty state when no records', () => {
    render(<StandupFeed records={[]} userNames={{}} />);
    expect(screen.getByText('No standups recorded yet')).toBeInTheDocument();
  });

  it('falls back to userId when name not in userNames map', () => {
    render(<StandupFeed records={mockRecords} userNames={{}} />);
    expect(screen.getByText('U1')).toBeInTheDocument();
    expect(screen.getByText('U2')).toBeInTheDocument();
  });
});
