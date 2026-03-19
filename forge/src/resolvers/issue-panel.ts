import Resolver from '@forge/resolver';
import { backendGet } from '../utils/api-client';

interface JiraIssueReference {
  issueKey: string;
  summary: string;
  status: string;
}

interface StandupRecord {
  userId: string;
  date: string;
  yesterday: JiraIssueReference[];
  today: JiraIssueReference[];
  blockers: string;
}

interface ByIssueResponse {
  records: StandupRecord[];
}

const resolver = new Resolver();

resolver.define('issue-panel-resolver', async (req) => {
  const issueKey = req.context.extension?.issue?.key;
  if (!issueKey) {
    return { mentions: [], error: 'No issue context available' };
  }

  const { data, error } = await backendGet<ByIssueResponse>(
    `/standup/by-issue?issueKey=${encodeURIComponent(issueKey)}&limit=10`,
  );

  if (error || !data) {
    return { mentions: [], error: error || 'Failed to fetch data' };
  }

  const mentions = data.records.map((record) => {
    const inYesterday = record.yesterday.some((i) => i.issueKey === issueKey);
    const inToday = record.today.some((i) => i.issueKey === issueKey);
    const context = inYesterday && inToday ? 'completed & planned'
      : inYesterday ? 'completed'
      : 'planned';

    return {
      userId: record.userId,
      date: record.date,
      context,
      blockers: record.blockers,
    };
  });

  return { mentions, error: null };
});

export const handler = resolver.getDefinitions();
