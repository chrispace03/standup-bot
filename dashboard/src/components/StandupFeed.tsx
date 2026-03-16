import type { StandupRecord } from '../api';

interface Props {
  records: StandupRecord[];
  userNames: Record<string, string>;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function StandupFeed({ records, userNames }: Props) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        No standups recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const hasBlockers = record.blockers && record.blockers !== 'None';
        return (
          <div
            key={`${record.date}_${record.userId}`}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {userNames[record.userId] || record.userId}
                </span>
                <span className="text-sm text-gray-400">{formatDate(record.date)}</span>
              </div>
              {hasBlockers && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  Blocked
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500 font-medium mb-1">Yesterday</p>
                {record.yesterday.length > 0 ? (
                  <ul className="text-gray-700 space-y-0.5">
                    {record.yesterday.map((issue) => (
                      <li key={issue.issueKey}>
                        <span className="text-purple-600 font-mono text-xs">{issue.issueKey}</span>{' '}
                        {issue.summary}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 italic">No items</p>
                )}
              </div>

              <div>
                <p className="text-gray-500 font-medium mb-1">Today</p>
                {record.today.length > 0 ? (
                  <ul className="text-gray-700 space-y-0.5">
                    {record.today.map((issue) => (
                      <li key={issue.issueKey}>
                        <span className="text-purple-600 font-mono text-xs">{issue.issueKey}</span>{' '}
                        {issue.summary}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 italic">No items</p>
                )}
              </div>

              <div>
                <p className="text-gray-500 font-medium mb-1">Blockers</p>
                <p className={hasBlockers ? 'text-red-600' : 'text-gray-400 italic'}>
                  {hasBlockers ? record.blockers : 'None'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
