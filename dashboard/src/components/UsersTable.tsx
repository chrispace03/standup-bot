import type { User } from '../api';

interface Props {
  users: User[];
  onSelect: (userId: string) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function UsersTable({ users, onSelect }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Timezone</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Days</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr
              key={user.slackUserId}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSelect(user.slackUserId)}
            >
              <td className="px-4 py-3 font-medium text-gray-900">{user.displayName}</td>
              <td className="px-4 py-3 text-gray-600">{user.timezone}</td>
              <td className="px-4 py-3 text-gray-600">{user.standupTime}</td>
              <td className="px-4 py-3 text-gray-600">
                {user.standupDays.map((d) => DAY_NAMES[d]).join(', ')}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.standupEnabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {user.standupEnabled ? 'Active' : 'Paused'}
                </span>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
