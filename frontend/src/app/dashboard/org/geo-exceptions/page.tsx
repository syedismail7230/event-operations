'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

interface GeoException {
  id: string;
  userId: string;
  eventId: string;
  reason: string;
  grantedAt: string;
  subject: { id: string; name: string; email: string; role: string };
  event: { id: string; name: string };
  granter: { id: string; name: string };
}

export default function GeoExceptionsPage() {
  const [exceptions, setExceptions] = useState<GeoException[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchExceptions(); }, []);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dashboard/org/geo-exceptions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setExceptions(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const revokeException = async (ex: GeoException) => {
    setRevokingId(ex.id);
    try {
      await fetch(`${API}/dashboard/org/geo-exceptions/${ex.eventId}/${ex.userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setExceptions(prev => prev.filter(e => e.id !== ex.id));
    } finally {
      setRevokingId(null);
    }
  };

  const filtered = exceptions.filter(e =>
    !filter || e.subject.name.toLowerCase().includes(filter.toLowerCase()) ||
    e.event.name.toLowerCase().includes(filter.toLowerCase()) ||
    e.subject.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="text-white font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
            🛡️ Geo-Fence Exception Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Users granted permission to operate outside event geo-fences.
          </p>
        </div>
        <button onClick={fetchExceptions}
          className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all">
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active Exceptions', value: exceptions.length, color: 'text-amber-400' },
          { label: 'Events Affected', value: new Set(exceptions.map(e => e.eventId)).size, color: 'text-blue-400' },
          { label: 'Unique Users', value: new Set(exceptions.map(e => e.userId)).size, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="🔍 Search by name, email, or event..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Exception list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-800/50 h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/20 border border-slate-700/50 rounded-2xl">
          <p className="text-5xl mb-4">🔒</p>
          <p className="text-lg font-semibold text-slate-400">
            {exceptions.length === 0 ? 'No active geo-fence exceptions' : 'No results match your search'}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {exceptions.length === 0
              ? 'All personnel are currently required to stay within their event geo-fence.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ex => {
            const isRevoking = revokingId === ex.id;
            const grantedDate = new Date(ex.grantedAt);
            return (
              <div key={ex.id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* User avatar + info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center font-bold text-amber-300 shrink-0">
                    {ex.subject.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 text-sm truncate">{ex.subject.name}</p>
                    <p className="text-xs text-slate-400 truncate">{ex.subject.email}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{ex.subject.role}</span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">📍 {ex.event.name}</span>
                    </div>
                  </div>
                </div>

                {/* Exception details */}
                <div className="flex-1 min-w-0 text-xs text-slate-400 space-y-1">
                  <p><span className="text-slate-500">Reason:</span> <span className="text-slate-300">{ex.reason}</span></p>
                  <p><span className="text-slate-500">Granted by:</span> <span className="text-slate-300">{ex.granter?.name || 'System'}</span></p>
                  <p><span className="text-slate-500">Granted at:</span> {grantedDate.toLocaleDateString()} {grantedDate.toLocaleTimeString()}</p>
                </div>

                {/* Status + Revoke */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-bold rounded-full">
                    🔓 ALLOWED
                  </span>
                  <button
                    onClick={() => revokeException(ex)}
                    disabled={isRevoking}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5"
                  >
                    {isRevoking ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Revoking</>
                    ) : (
                      <>🔒 Revoke</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-amber-400 font-bold">ℹ️ How geo-fence exceptions work:</span>{' '}
          When an attendee or volunteer is detected outside an event's geo-boundary, a violation alert is triggered.
          Granting an exception disables future alerts for that specific user+event pair.
          Revoking reinstates the geo-fence enforcement, and any subsequent boundary breach will again trigger a live alert.
        </p>
      </div>
    </div>
  );
}
