'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useState, useEffect } from 'react';

const ROLE_COLORS: Record<string, string> = {
  VOLUNTEER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MANAGER: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  USER: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  PENDING: 'bg-yellow-500',
  REJECTED: 'bg-red-500',
};

export default function PersonnelAllocationModule() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/org/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/dashboard/org/users/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      fetchUsers();
    } catch (e) { console.error(e); }
  };

  const filtered = users.filter(u => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const stats = {
    total: users.length,
    volunteers: users.filter(u => u.role === 'VOLUNTEER').length,
    managers: users.filter(u => u.role === 'MANAGER').length,
    active: users.filter(u => u.status === 'ACTIVE').length,
  };

  return (
    <div className="text-white font-sans">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Personnel & Volunteers
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage workforce roles, assignments, and operational status.</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Personnel', value: stats.total, color: 'from-slate-600 to-slate-700' },
          { label: 'Active', value: stats.active, color: 'from-green-900 to-green-800' },
          { label: 'Volunteers', value: stats.volunteers, color: 'from-emerald-900 to-emerald-800' },
          { label: 'Managers', value: stats.managers, color: 'from-purple-900 to-purple-800' },
        ].map(stat => (
          <div key={stat.label} className={`bg-gradient-to-br ${stat.color} border border-slate-700/50 rounded-xl p-4`}>
            <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold font-mono">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
        <div className="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {['ALL', 'MANAGER', 'VOLUNTEER', 'USER'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${roleFilter === r ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Personnel Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl h-32"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(user => (
            <div key={user.id} className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-purple-500/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-bold shadow-lg">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100 text-sm">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[140px]">{user.email}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 text-[10px] font-medium ${user.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[user.status] || 'bg-slate-500'}`}></span>
                  {user.status}
                </span>
              </div>

              {user.phone && (
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                  <span>📱</span> {user.phone}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${ROLE_COLORS[user.role] || ROLE_COLORS['USER']}`}>
                  {user.role}
                </span>
                <select
                  value={user.role}
                  onChange={e => handleRoleChange(user.id, e.target.value)}
                  className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                >
                  <option value="USER">User</option>
                  <option value="VOLUNTEER">Volunteer</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-slate-500 col-span-3 text-center py-12">No personnel found for the selected filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
