import { useEffect, useState } from 'react';
import { api, type StandupRecord, type User } from '../api';
import { StandupFeed } from './StandupFeed';

interface Props {
  user: User;
  onBack: () => void;
}

export function UserDetail({ user, onBack }: Props) {
  const [records, setRecords] = useState<StandupRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUserHistory(user.slackUserId, 30).then((data) => {
      setRecords(data.records);
      setLoading(false);
    });
  }, [user.slackUserId]);

  const nameMap = { [user.slackUserId]: user.displayName };

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-purple-600 hover:text-purple-800 mb-4 flex items-center gap-1"
      >
        &larr; Back to team
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{user.displayName}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Timezone</p>
            <p className="text-gray-900 font-medium">{user.timezone}</p>
          </div>
          <div>
            <p className="text-gray-500">Standup Time</p>
            <p className="text-gray-900 font-medium">{user.standupTime}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                user.standupEnabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {user.standupEnabled ? 'Active' : 'Paused'}
            </span>
          </div>
          <div>
            <p className="text-gray-500">Google Calendar</p>
            <p className="text-gray-900 font-medium">
              {user.googleConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-3">Standup History</h3>
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <StandupFeed records={records} userNames={nameMap} />
      )}
    </div>
  );
}
