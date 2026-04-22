'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

const CATEGORY_STYLE: Record<string, { border: string; icon: string; badge: string }> = {
  SECURITY: { border: 'border-red-500/30', icon: '🚨', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  MEDICAL:  { border: 'border-orange-500/30', icon: '🏥', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  TECHNICAL:{ border: 'border-blue-500/30', icon: '⚙️', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  GENERAL:  { border: 'border-slate-500/30', icon: '📋', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-red-500/10 text-red-400 border-red-500/20',
  IN_PROGRESS: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  RESOLVED: 'bg-green-500/10 text-green-400 border-green-500/20',
};

export default function IncidentsModule() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ eventId: '', category: 'GENERAL', description: '' });
  const socketRef = useRef<Socket | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetchAll();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);
    socket.on('incident_created', (inc: any) => setIncidents(prev => [inc, ...prev]));
    socket.on('incident_updated', (upd: any) => setIncidents(prev => prev.map(i => i.id === upd.id ? upd : i)));
    return () => { socket.disconnect(); };
  }, []);

  const fetchAll = async () => {
    try {
      const [incRes, evRes] = await Promise.all([
        fetch(`${API}/dashboard/org/incidents`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/events`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (incRes.ok) setIncidents(await incRes.json());
      if (evRes.ok) setEvents(await evRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/dashboard/org/incidents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setShowModal(false);
  };

  const handleStatusChange = async (incidentId: string, status: string) => {
    const res = await fetch(`${API}/dashboard/org/incidents/${incidentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      // Optimistically update local state immediately
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, status } : i));
    }
  };

  const filtered = filter === 'ALL' ? incidents : incidents.filter(i => i.status === filter || i.category === filter);

  return (
    <div className="text-white font-sans">
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Issue & Incident Management</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time incident triage and resolution tracking.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]">🚨 Report Incident</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Open', value: incidents.filter(i => i.status === 'OPEN').length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'In Progress', value: incidents.filter(i => i.status === 'IN_PROGRESS').length, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Resolved', value: incidents.filter(i => i.status === 'RESOLVED').length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit flex-wrap">
        {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'SECURITY', 'MEDICAL', 'TECHNICAL', 'GENERAL'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl h-28"></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">✅</p>
          <p>No incidents found. All clear!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(inc => {
            const cat = CATEGORY_STYLE[inc.category] || CATEGORY_STYLE['GENERAL'];
            return (
              <div key={inc.id} className={`bg-slate-800/40 border ${cat.border} rounded-xl p-6 hover:bg-slate-800/60 transition-all`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{cat.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-500">INC-{inc.id.slice(-6).toUpperCase()}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${cat.badge}`}>{inc.category}</span>
                      </div>
                      <p className="text-sm text-slate-200">{inc.description}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border shrink-0 ${STATUS_BADGE[inc.status]}`}>
                    {inc.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-700/50 pt-3">
                  <span>Reported by <span className="text-slate-300">{inc.reporter?.name}</span> · {inc.event?.name}</span>
                  <span className="font-mono">{new Date(inc.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {inc.status === 'OPEN' && (
                    <button onClick={() => handleStatusChange(inc.id, 'IN_PROGRESS')} className="text-xs px-3 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded transition-colors">Mark In Progress</button>
                  )}
                  {inc.status !== 'RESOLVED' && (
                    <button onClick={() => handleStatusChange(inc.id, 'RESOLVED')} className="text-xs px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded transition-colors">Mark Resolved</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative mx-4">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            <h2 className="text-xl font-bold mb-6 text-white">Report New Incident</h2>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Event</label>
                <select required value={form.eventId} onChange={e => setForm({...form, eventId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500">
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500">
                  {['GENERAL', 'SECURITY', 'MEDICAL', 'TECHNICAL'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea required rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500" placeholder="Describe the incident..." />
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-all">Submit Incident</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
