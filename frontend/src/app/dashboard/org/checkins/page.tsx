'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

const DIR_STYLE: Record<string, string> = {
  IN: 'bg-green-500/10 text-green-400 border-green-500/20',
  OUT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export default function CheckInLogsModule() {
  const [logs, setLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ eventId: '', userId: '', direction: 'IN' });
  const [users, setUsers] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetchAll();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);
    socket.on('checkin_created', (ci: any) => {
      setLogs(prev => [ci, ...prev]);
    });
    return () => { socket.disconnect(); };
  }, []);

  const fetchAll = async () => {
    try {
      const [ciRes, evRes, usersRes] = await Promise.all([
        fetch(`${API}/dashboard/org/checkins`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (ciRes.ok) setLogs(await ciRes.json());
      if (evRes.ok) setEvents(await evRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/dashboard/org/checkins`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) { setShowModal(false); }
  };

  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.direction === filter);

  const ins = logs.filter(l => l.direction === 'IN').length;
  const outs = logs.filter(l => l.direction === 'OUT').length;

  return (
    <div className="text-white font-sans">
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Check-In / Check-Out Logs</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time entry & exit tracking from AWS RDS.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {['ALL', 'IN', 'OUT'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>{f}</button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all">+ Manual Entry</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Check-Ins', value: ins, color: 'text-green-400' },
          { label: 'Total Check-Outs', value: outs, color: 'text-orange-400' },
          { label: 'Currently Inside', value: Math.max(0, ins - outs), color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-6 py-3 bg-slate-800/60 border-b border-slate-700 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Activity Feed — Socket.io Real-time</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Loading from database...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-3xl mb-2">📭</p>
            <p>No check-in records yet. Use Manual Entry or QR Check-In.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50 max-h-[500px] overflow-y-auto">
            {filtered.map(log => (
              <div key={log.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/60 transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border ${log.direction === 'IN' ? 'bg-green-600/20 border-green-500/30 text-green-400' : 'bg-orange-600/20 border-orange-500/30 text-orange-400'}`}>
                  {log.user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-200 text-sm">{log.user?.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{log.event?.name || 'Unknown Event'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${DIR_STYLE[log.direction]}`}>
                  {log.direction === 'IN' ? '↓ CHECK-IN' : '↑ CHECK-OUT'}
                </span>
                <span className="font-mono text-sm text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative mx-4">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            <h2 className="text-xl font-bold mb-6 text-white">Manual Check-In Entry</h2>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Event</label>
                <select required value={form.eventId} onChange={e => setForm({...form, eventId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500">
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">User</label>
                <select required value={form.userId} onChange={e => setForm({...form, userId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500">
                  <option value="">Select user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Direction</label>
                <select value={form.direction} onChange={e => setForm({...form, direction: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500">
                  <option value="IN">CHECK-IN</option>
                  <option value="OUT">CHECK-OUT</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all">Record Entry</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
