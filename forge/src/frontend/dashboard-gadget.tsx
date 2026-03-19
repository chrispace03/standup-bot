import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Heading, Stack, Badge } from '@forge/react';
import { invoke } from '@forge/bridge';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  standupsToday: number;
  standupsThisWeek: number;
  blockersThisWeek: number;
  issuesCompleted: number;
  issuesPlanned: number;
  meetingsThisWeek: number;
}

interface ResolverResponse {
  stats: Stats | null;
  error: string | null;
}

function DashboardGadget() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ResolverResponse>('dashboard-gadget-resolver').then((response) => {
      setStats(response.stats);
      setError(response.error);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Text>Loading...</Text>;
  }

  if (error || !stats) {
    return <Text>Unable to load standup stats: {error || 'Unknown error'}</Text>;
  }

  return (
    <Stack space="space.100">
      <Heading as="h3">Today's Standups</Heading>
      <Text>
        Completed: {stats.standupsToday} / {stats.activeUsers} active users
      </Text>
      <Text>
        Issues completed this week: {stats.issuesCompleted}
      </Text>
      <Text>
        Issues planned: {stats.issuesPlanned}
      </Text>
      {stats.blockersThisWeek > 0 ? (
        <Text>
          <Badge appearance="removed">{stats.blockersThisWeek} blockers</Badge> this week
        </Text>
      ) : (
        <Text>
          <Badge appearance="added">No blockers</Badge> this week
        </Text>
      )}
    </Stack>
  );
}

ForgeReconciler.render(<DashboardGadget />);
