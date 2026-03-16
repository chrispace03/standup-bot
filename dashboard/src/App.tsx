import { useEffect, useState } from 'react';
import { api, type User, type StandupRecord, type DashboardStats } from './api';
import { StatsCards } from './components/StatsCards';
import { UsersTable } from './components/UsersTable';
import { StandupFeed } from './components/StandupFeed';
import { UserDetail } from './components/UserDetail';

type Tab = 'overview' | 'standups' | 'users';

function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [standups, setStandups] = useState<StandupRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getUsers(),
      api.getStandups(),
    ])
      .then(([statsData, usersData, standupsData]) => {
        setStats(statsData);
        setUsers(usersData.users);
        setStandups(standupsData.records);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const userNames = users.reduce<Record<string, string>>((acc, u) => {
    acc[u.slackUserId] = u.displayName;
    return acc;
  }, {});

  function handleSelectUser(userId: string) {
    const user = users.find((u) => u.slackUserId === userId);
    if (user) setSelectedUser(user);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border border-red-200 p-6 max-w-md">
          <p className="text-red-600 font-medium">Failed to load dashboard</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
          <p className="text-gray-400 text-xs mt-3">
            Make sure the backend is running on port 3000.
          </p>
        </div>
      </div>
    );
  }

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Standup Bot Dashboard</h1>
          <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
            {(['overview', 'standups', 'users'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <StatsCards stats={stats} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Team Activity</h2>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Standups This Week</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.userActivity.map((ua) => (
                      <tr
                        key={ua.userId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectUser(ua.userId)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{ua.displayName}</td>
                        <td className="px-4 py-3 text-gray-600">{ua.standupsThisWeek}</td>
                        <td className="px-4 py-3">
                          {ua.hasBlockers ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Clear
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'standups' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Standups</h2>
            <StandupFeed records={standups} userNames={userNames} />
          </div>
        )}

        {tab === 'users' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Team Members</h2>
            <UsersTable users={users} onSelect={handleSelectUser} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
