'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

// Dynamic import so Leaflet never runs in SSR
const GeoFenceMap = dynamic(() => import('../components/GeoFenceMap'), { 
  ssr: false,
  loading: () => <div className="h-[360px] bg-slate-800/50 rounded-xl flex items-center justify-center text-slate-500 text-sm animate-pulse">Loading map...</div>
});

interface Event {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  latitude: number | null;
  longitude: number | null;
  geoBoundary: string | null;
  _count?: { checkIns: number; incidents: number; personnel: number };
}

type ModalMode = 'create' | 'configure' | 'monitor' | null;

const EMPTY_FORM = { name: '', description: '', startTime: '', endTime: '', latitude: '', longitude: '', geoBoundary: '' };

export default function OrgEventsManagement() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [boundary, setBoundary] = useState<[number, number][]>([]);
  const socketRef = useRef<Socket | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetchEvents();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);
    socket.on('event_created', (ev: Event) => setEvents(prev => [ev, ...prev]));
    socket.on('event_updated', (ev: Event) => setEvents(prev => prev.map(e => e.id === ev.id ? ev : e)));
    socket.on('event_deleted', ({ id }: { id: string }) => setEvents(prev => prev.filter(e => e.id !== id)));
    return () => { socket.disconnect(); };
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API}/dashboard/org/events`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEvents(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setBoundary([]); setError(''); setModal('create'); };
  const openConfigure = (ev: Event) => { 
    setSelectedEvent(ev); 
    setBoundary(ev.geoBoundary ? JSON.parse(ev.geoBoundary) : []);
    setForm({ 
      name: ev.name, description: ev.description || '', 
      startTime: ev.startTime.slice(0, 16), endTime: ev.endTime.slice(0, 16),
      latitude: ev.latitude?.toString() || '', longitude: ev.longitude?.toString() || '',
      geoBoundary: ev.geoBoundary || ''
    }); 
    setError('');
    setModal('configure'); 
  };
  const openMonitor = (ev: Event) => { setSelectedEvent(ev); setModal('monitor'); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, geoBoundary: boundary.length > 0 ? JSON.stringify(boundary) : undefined };
      const res = await fetch(`${API}/dashboard/org/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setModal(null);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, geoBoundary: boundary.length > 0 ? JSON.stringify(boundary) : null };
      const res = await fetch(`${API}/dashboard/org/events/${selectedEvent!.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update event');
      setModal(null);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Archive this event? This cannot be undone.')) return;
    await fetch(`${API}/dashboard/org/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  const eventStatus = (ev: Event) => {
    const now = new Date();
    const start = new Date(ev.startTime);
    const end = new Date(ev.endTime);
    if (now < start) return { label: 'UPCOMING', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    if (now > end) return { label: 'COMPLETED', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    return { label: 'LIVE', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  };

  const isConfigureMode = modal === 'configure';
  const formSubmit = isConfigureMode ? handleUpdate : handleCreate;
  const formTitle = isConfigureMode ? `Configure: ${selectedEvent?.name}` : 'Create New Event';

  return (
    <div className="text-white font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Event Management Core</h1>
          <p className="text-sm text-slate-400 mt-1">Full lifecycle control — create, configure, monitor, archive.</p>
        </div>
        <button onClick={openCreate} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(13,148,136,0.3)] flex items-center gap-2">
          <span className="text-lg">＋</span> Create Event
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl h-52"></div>)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-lg font-semibold text-slate-400">No Events Yet</p>
          <p className="text-sm mt-1 mb-6">Create your first event to start managing attendees, personnel and check-ins.</p>
          <button onClick={openCreate} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-lg transition-all">Create First Event</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(ev => {
            const status = eventStatus(ev);
            const hasBoundary = !!ev.geoBoundary;
            return (
              <div key={ev.id} className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 hover:border-teal-500/30 transition-all group relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-teal-500/15 transition-all"></div>

                <div className="flex justify-between items-start mb-3 relative z-10">
                  <h3 className="text-lg font-bold text-slate-100 pr-2 leading-tight">{ev.name}</h3>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border shrink-0 ${status.color}`}>{status.label}</span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-4 relative z-10">{ev.description || 'No description.'}</p>

                <div className="text-xs text-slate-500 space-y-1 mb-4 relative z-10">
                  <p>🕒 {new Date(ev.startTime).toLocaleString()} → {new Date(ev.endTime).toLocaleString()}</p>
                  {hasBoundary && <p className="text-teal-400">🗺️ Geo-boundary set</p>}
                  {ev.latitude && !hasBoundary && <p>📍 {ev.latitude?.toFixed(4)}, {ev.longitude?.toFixed(4)}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-4 relative z-10">
                  {[
                    { label: 'Check-ins', val: ev._count?.checkIns ?? 0 },
                    { label: 'Incidents', val: ev._count?.incidents ?? 0 },
                    { label: 'Personnel', val: ev._count?.personnel ?? 0 },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-900/50 p-2 rounded border border-slate-800 text-center">
                      <p className="text-base font-mono font-bold text-slate-200">{s.val}</p>
                      <p className="text-slate-500 text-[10px]">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-auto relative z-10">
                  <button onClick={() => openConfigure(ev)} className="flex-1 bg-slate-700 hover:bg-teal-700 text-xs py-2 rounded-lg transition-colors font-semibold">⚙️ Configure</button>
                  <button onClick={() => openMonitor(ev)} className="flex-1 bg-slate-700 hover:bg-blue-700 text-xs py-2 rounded-lg transition-colors font-semibold">📡 Monitor</button>
                  <button onClick={() => handleDelete(ev.id)} className="bg-slate-700 hover:bg-red-800 text-xs py-2 px-3 rounded-lg transition-colors">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CREATE / CONFIGURE MODAL ─── */}
      {(modal === 'create' || modal === 'configure') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl my-4 relative">
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg z-10">✕</button>
            <h2 className="text-xl font-bold mb-6 text-white pr-8">{formTitle}</h2>
            
            <form onSubmit={formSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1">Event Name *</label>
                  <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1">Description</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Start Date & Time *</label>
                  <input required type="datetime-local" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">End Date & Time *</label>
                  <input required type="datetime-local" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500" />
                </div>
              </div>

              {/* GEO-FENCE MAP */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-400 font-semibold flex items-center gap-2">
                    🗺️ Geo-Fence Boundary
                    <span className="text-xs font-normal text-slate-500">(draw on the map to set event zone)</span>
                  </label>
                  {boundary.length > 0 && (
                    <span className="text-xs text-teal-400 font-semibold">{boundary.length} points drawn ✓</span>
                  )}
                </div>
                <GeoFenceMap
                  key={`${modal}-${selectedEvent?.id ?? 'new'}`}
                  onBoundaryChange={setBoundary}
                  initialCoords={boundary.length > 0 ? boundary : undefined}
                  center={form.latitude && form.longitude ? [parseFloat(form.latitude), parseFloat(form.longitude)] : undefined}
                  onLocationPick={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toString(), longitude: lng.toString() }))}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Optionally set a center point for fallback map display:
                </p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Center Latitude</label>
                    <input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Center Longitude</label>
                    <input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500" />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

              <button type="submit" disabled={saving} className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all">
                {saving ? 'Saving...' : isConfigureMode ? 'Save Configuration' : 'Launch Event'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MONITOR MODAL ─── */}
      {modal === 'monitor' && selectedEvent && (
        <MonitorPanel event={selectedEvent} token={token!} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ─── PER-EVENT MONITOR PANEL ───
function MonitorPanel({ event, token, onClose }: { event: Event; token: string; onClose: () => void }) {
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<'checkins' | 'incidents'>('checkins');

  useEffect(() => {
    const fetchMonitorData = async () => {
      try {
        const [ciRes, incRes] = await Promise.all([
          fetch(`${API}/dashboard/org/checkins`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/dashboard/org/incidents`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (ciRes.ok) {
          const all = await ciRes.json();
          setCheckIns(all.filter((c: any) => c.eventId === event.id));
        }
        if (incRes.ok) {
          const all = await incRes.json();
          setIncidents(all.filter((i: any) => i.eventId === event.id));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchMonitorData();

    const socket = io('${process.env.NEXT_PUBLIC_API_URL}', { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_event_room', event.id);
    socket.on('checkin_created', (ci: any) => { if (ci.eventId === event.id) setCheckIns(prev => [ci, ...prev]); });
    socket.on('incident_created', (inc: any) => { if (inc.eventId === event.id) setIncidents(prev => [inc, ...prev]); });
    socket.on('incident_updated', (upd: any) => setIncidents(prev => prev.map(i => i.id === upd.id ? upd : i)));
    return () => { socket.disconnect(); };
  }, [event.id, token]);

  const ins = checkIns.filter(c => c.direction === 'IN').length;
  const outs = checkIns.filter(c => c.direction === 'OUT').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
              <span className="text-xs text-green-400 font-mono font-bold">LIVE MONITORING</span>
            </div>
            <h2 className="text-xl font-bold text-white">{event.name}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 p-6 pb-0">
          {[
            { label: 'Check-Ins', val: ins, color: 'text-green-400' },
            { label: 'Check-Outs', val: outs, color: 'text-orange-400' },
            { label: 'Inside Now', val: Math.max(0, ins - outs), color: 'text-blue-400' },
            { label: 'Incidents', val: incidents.filter(i => i.status !== 'RESOLVED').length, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mt-4 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {(['checkins', 'incidents'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all capitalize ${activeTab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t === 'checkins' ? `✅ Check-Ins (${checkIns.length})` : `🚨 Incidents (${incidents.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-800/50 rounded"></div>)}
            </div>
          ) : activeTab === 'checkins' ? (
            checkIns.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No check-ins recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {checkIns.map(ci => (
                  <div key={ci.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/40">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${ci.direction === 'IN' ? 'bg-green-600/20 text-green-400' : 'bg-orange-600/20 text-orange-400'}`}>
                      {ci.user?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">{ci.user?.name}</p>
                      <p className="text-xs text-slate-500">{ci.user?.role}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${ci.direction === 'IN' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                      {ci.direction === 'IN' ? '↓ IN' : '↑ OUT'}
                    </span>
                    <span className="text-xs font-mono text-slate-500">{new Date(ci.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            incidents.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No incidents for this event. ✅</div>
            ) : (
              <div className="space-y-2">
                {incidents.map(inc => (
                  <div key={inc.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/40">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-300">{inc.category}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inc.status === 'RESOLVED' ? 'bg-green-500/10 text-green-400' : inc.status === 'IN_PROGRESS' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>{inc.status}</span>
                    </div>
                    <p className="text-sm text-slate-400">{inc.description}</p>
                    <p className="text-xs text-slate-600 mt-1">Reported by {inc.reporter?.name} · {new Date(inc.createdAt).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
