import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Heading, Stack, Table, Head, Row, Cell, Badge } from '@forge/react';
import { invoke } from '@forge/bridge';

interface UserActivity {
  userId: string;
  displayName: string;
  standupsThisWeek: number;
  hasBlockers: boolean;
}

interface Stats {
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

interface ResolverResponse {
  stats: Stats | null;
  standups: StandupRecord[];
  error: string | null;
}

function ProjectPage() {
  const [data, setData] = useState<ResolverResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ResolverResponse>('project-page-resolver').then((response) => {
      setData(response);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Text>Loading team standups...</Text>;
  }

  if (data?.error || !data?.stats) {
    return <Text>Unable to load standup data: {data?.error || 'Unknown error'}</Text>;
  }

  const { stats, standups } = data;

  return (
    <Stack space="space.200">
      <Heading as="h2">Team Standups</Heading>

      <Stack space="space.100">
        <Heading as="h3">This Week</Heading>
        <Text>
          Standups today: {stats.standupsToday} | This week: {stats.standupsThisWeek} |{' '}
          Issues completed: {stats.issuesCompleted} | Planned: {stats.issuesPlanned} |{' '}
          Blockers: {stats.blockersThisWeek} | Meetings: {stats.meetingsThisWeek}
        </Text>
      </Stack>

      <Stack space="space.100">
        <Heading as="h3">Team Activity</Heading>
        <Table>
          <Head>
            <Cell><Text>Member</Text></Cell>
            <Cell><Text>Standups</Text></Cell>
            <Cell><Text>Status</Text></Cell>
          </Head>
          {stats.userActivity.map((user, index) => (
            <Row key={index}>
              <Cell><Text>{user.displayName}</Text></Cell>
              <Cell><Text>{user.standupsThisWeek}</Text></Cell>
              <Cell>
                {user.hasBlockers ? (
                  <Badge appearance="removed">Blocked</Badge>
                ) : (
                  <Badge appearance="added">Clear</Badge>
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      </Stack>

      <Stack space="space.100">
        <Heading as="h3">Recent Standups</Heading>
        <Table>
          <Head>
            <Cell><Text>Date</Text></Cell>
            <Cell><Text>User</Text></Cell>
            <Cell><Text>Completed</Text></Cell>
            <Cell><Text>Planned</Text></Cell>
            <Cell><Text>Blockers</Text></Cell>
          </Head>
          {standups.map((standup, index) => (
            <Row key={index}>
              <Cell><Text>{standup.date}</Text></Cell>
              <Cell><Text>{standup.userId}</Text></Cell>
              <Cell><Text>{standup.yesterday.length} issues</Text></Cell>
              <Cell><Text>{standup.today.length} issues</Text></Cell>
              <Cell>
                <Text>{standup.blockers === 'None' ? '-' : standup.blockers}</Text>
              </Cell>
            </Row>
          ))}
        </Table>
      </Stack>
    </Stack>
  );
}

ForgeReconciler.render(<ProjectPage />);
