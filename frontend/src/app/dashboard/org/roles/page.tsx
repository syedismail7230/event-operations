'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

const ROLE_PERMS: Record<string, { label: string; perms: string[] }> = {
  ORG_ADMIN: { label: 'Org Admin', perms: ['Create Events', 'Delete Events', 'Approve Users', 'Manage Personnel', 'View Analytics', 'Broadcast Notifications', 'Manage Channels', 'View Audit Logs'] },
  MANAGER: { label: 'Manager', perms: ['Create Events', 'Approve Users', 'Manage Personnel', 'View Analytics', 'Broadcast Notifications', 'Manage Channels'] },
  VOLUNTEER: { label: 'Volunteer', perms: ['View Events', 'Check-In Users', 'Report Incidents', 'Use PTT Channels'] },
  USER: { label: 'Attendee', perms: ['View Events', 'Self Check-In'] },
};

const ALL_PERMS = ['Create Events', 'Delete Events', 'Approve Users', 'Manage Personnel', 'View Analytics', 'Broadcast Notifications', 'Manage Channels', 'View Audit Logs', 'Check-In Users', 'Report Incidents', 'Use PTT Channels', 'View Events', 'Self Check-In'];

export default function RolePermissionsModule() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/dashboard/org/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setUsers(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    await fetch(`${API}/dashboard/org/users/${userId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const roleCounts = Object.fromEntries(Object.keys(ROLE_PERMS).map(r => [r, users.filter(u => u.role === r).length]));

  return (
    <div className="text-white font-sans">
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Role Permissions</h1>
        <p className="text-sm text-slate-400 mt-1">Manage user roles and view permission matrices for your organization.</p>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(ROLE_PERMS).map(([role, info]) => (
          <button key={role} onClick={() => setSelectedRole(selectedRole === role ? null : role)}
            className={`text-left p-4 rounded-xl border transition-all ${selectedRole === role ? 'border-violet-500/50 bg-violet-500/10' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'}`}>
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">{info.label}</p>
            <p className="text-3xl font-bold font-mono text-white">{roleCounts[role] || 0}</p>
            <p className="text-xs text-slate-500 mt-1">{info.perms.length} permissions</p>
          </button>
        ))}
      </div>

      {/* Permission Matrix */}
      {selectedRole && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{ROLE_PERMS[selectedRole].label} — Permission Matrix</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_PERMS.map(perm => {
              const hasIt = ROLE_PERMS[selectedRole].perms.includes(perm);
              return (
                <div key={perm} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${hasIt ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-900/50 border-slate-700/30 text-slate-600'}`}>
                  <span>{hasIt ? '✓' : '✗'}</span> {perm}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Role Assignment Table */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300">User Role Assignments</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase border-b border-slate-700">
            <tr>
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">Current Role</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">Reassign</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-500 animate-pulse">Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-500">No users in organization.</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-200">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded border bg-violet-500/10 text-violet-400 border-violet-500/20">{user.role}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-bold ${user.status === 'ACTIVE' ? 'text-green-400' : user.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400'}`}>● {user.status}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer">
                    <option value="USER">User</option>
                    <option value="VOLUNTEER">Volunteer</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
