'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

export default function AuditLogsModule() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/dashboard/org/audit`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setLogs(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = logs.filter(l =>
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase()) ||
    l.targetType?.toLowerCase().includes(search.toLowerCase())
  );

  const ACTION_COLOR: Record<string, string> = {
    EVENT_CREATED: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    USER_STATUS_ACTIVE: 'text-green-400 bg-green-500/10 border-green-500/20',
    USER_STATUS_REJECTED: 'text-red-400 bg-red-500/10 border-red-500/20',
    BROADCAST_NOTIFICATION: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    PROFILE_UPDATED: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className="text-white font-sans">
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">Audit Logs</h1>
          <p className="text-sm text-slate-400 mt-1">Complete tamper-evident action history for your organization.</p>
        </div>
        <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">{filtered.length} records</span>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Filter by action, type, or details..."
        className="w-full mb-6 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors" />

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase border-b border-slate-700">
            <tr>
              <th className="px-5 py-3 text-left">Action</th>
              <th className="px-5 py-3 text-left">Target</th>
              <th className="px-5 py-3 text-left">Details</th>
              <th className="px-5 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-slate-500 animate-pulse">Loading audit trail...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-slate-500">No audit records found.</td></tr>
            ) : filtered.map(log => (
              <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${ACTION_COLOR[log.action] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                    {log.action?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-400 text-xs">{log.targetType}</td>
                <td className="px-5 py-3 text-slate-400 text-xs max-w-xs truncate">{log.details}</td>
                <td className="px-5 py-3 text-right text-slate-500 text-xs font-mono">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
