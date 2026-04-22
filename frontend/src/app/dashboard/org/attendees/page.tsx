'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useState, useEffect } from 'react';

export default function AttendeeApprovalPipeline() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/org/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/dashboard/org/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = filter === 'ALL' ? users : users.filter(u => u.status === filter);

  return (
    <div className="text-white font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">Registration Pipeline</h1>
          <p className="text-sm text-slate-400 mt-1">Approve, reject, and manage attendee and staff access.</p>
        </div>
        
        <div className="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
           {['ALL', 'PENDING', 'ACTIVE', 'REJECTED'].map(f => (
             <button 
               key={f}
               onClick={() => setFilter(f)}
               className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filter === f ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
             >
               {f}
             </button>
           ))}
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/80 text-slate-400 uppercase text-xs border-b border-slate-700">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Registered</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-500">Loading pipeline...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-500">No users found for this filter.</td></tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-200">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                  {user.phone && <div className="text-xs text-slate-500">{user.phone}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${user.role === 'VOLUNTEER' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : user.role === 'MANAGER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                   <span className={`flex items-center gap-2 text-xs font-medium ${user.status === 'ACTIVE' ? 'text-green-400' : user.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400'}`}>
                     <span className={`w-2 h-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-green-500' : user.status === 'PENDING' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                     {user.status}
                   </span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {user.status !== 'ACTIVE' && (
                      <button onClick={() => handleStatusChange(user.id, 'ACTIVE')} className="px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded text-xs transition-colors">
                        Approve
                      </button>
                    )}
                    {user.status !== 'REJECTED' && (
                      <button onClick={() => handleStatusChange(user.id, 'REJECTED')} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs transition-colors">
                        Reject
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
