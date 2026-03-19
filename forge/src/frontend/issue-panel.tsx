import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Heading, Stack, Badge } from '@forge/react';
import { invoke } from '@forge/bridge';

interface Mention {
  userId: string;
  date: string;
  context: string;
  blockers: string;
}

interface ResolverResponse {
  mentions: Mention[];
  error: string | null;
}

function IssuePanel() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ResolverResponse>('issue-panel-resolver').then((response) => {
      setMentions(response.mentions);
      setError(response.error);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Text>Loading standup mentions...</Text>;
  }

  if (error) {
    return <Text>Unable to load standup data: {error}</Text>;
  }

  if (mentions.length === 0) {
    return <Text>No standup mentions for this issue yet.</Text>;
  }

  return (
    <Stack space="space.100">
      <Heading as="h3">Recent Standup Mentions</Heading>
      {mentions.map((mention, index) => (
        <Stack key={index} space="space.050">
          <Text>
            <Badge appearance={mention.context === 'completed' ? 'added' : 'default'}>
              {mention.context}
            </Badge>
            {' '}{mention.userId} — {mention.date}
          </Text>
          {mention.blockers && mention.blockers !== 'None' && (
            <Text>Blocker: {mention.blockers}</Text>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

ForgeReconciler.render(<IssuePanel />);
