'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

export default function ManagerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [evRes, ciRes, incRes] = await Promise.all([
        fetch(`${API}/dashboard/org/events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/checkins`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/incidents`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const events = evRes.ok ? await evRes.json() : [];
      const checkins = ciRes.ok ? await ciRes.json() : [];
      const incidents = incRes.ok ? await incRes.json() : [];
      setData({ events, checkins, incidents });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const now = new Date();
  const liveEvents = data?.events?.filter((e: any) => new Date(e.startTime) <= now && new Date(e.endTime) >= now) || [];
  const todayCheckins = data?.checkins?.filter((c: any) => new Date(c.timestamp).toDateString() === now.toDateString()) || [];
  const openIncidents = data?.incidents?.filter((i: any) => i.status !== 'RESOLVED') || [];

  const stats = [
    { label: 'Live Events', value: liveEvents.length, icon: '📍', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: "Today's Check-Ins", value: todayCheckins.length, icon: '✅', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Open Incidents', value: openIncidents.length, icon: '🚨', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Total Events', value: data?.events?.length || 0, icon: '📅', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
  ];

  const quickLinks = [
    { label: 'Live Map', icon: '🗺️', href: '/dashboard/org/map', desc: 'Track personnel in real-time' },
    { label: 'Check-In Logs', icon: '✅', href: '/dashboard/org/checkins', desc: 'View all entry/exit records' },
    { label: 'Incidents', icon: '🚨', href: '/dashboard/org/incidents', desc: 'Manage open issues' },
    { label: 'Walkie-Talkie', icon: '📻', href: '/dashboard/org/ptt', desc: 'PTT voice channels' },
    { label: 'Events', icon: '📅', href: '/dashboard/org/events', desc: 'View and monitor events' },
    { label: 'Personnel', icon: '👷', href: '/dashboard/org/personnel', desc: 'Manage field staff' },
  ];

  return (
    <div className="text-white font-sans">
      {/* Header */}
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Manager Operations Hub
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Welcome back, <span className="text-slate-200 font-semibold">{user.name}</span> · Real-time event oversight
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className={`border rounded-2xl p-5 ${s.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{s.icon}</span>
              {loading && <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />}
            </div>
            <p className={`text-3xl font-bold font-mono ${s.color}`}>{loading ? '—' : s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map(l => (
            <a key={l.href} href={l.href}
              className="bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 flex items-start gap-3 transition-all hover:bg-slate-800 group">
              <span className="text-2xl mt-0.5">{l.icon}</span>
              <div>
                <p className="font-semibold text-sm text-slate-200 group-hover:text-white transition-colors">{l.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{l.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Live Events + Recent Incidents side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Events */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            Live Events
          </h2>
          {loading ? <div className="animate-pulse space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-slate-700/50 rounded-lg" />)}</div>
            : liveEvents.length === 0 ? <p className="text-slate-500 text-sm py-4 text-center">No events live right now.</p>
            : (
              <div className="space-y-3">
                {liveEvents.map((ev: any) => (
                  <div key={ev.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="font-semibold text-slate-200">{ev.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(ev.startTime).toLocaleTimeString()} — {new Date(ev.endTime).toLocaleTimeString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <a href="/dashboard/org/map" className="text-xs text-teal-400 hover:text-teal-300 transition-colors">🗺️ Live Map →</a>
                      <a href="/dashboard/org/checkins" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">✅ Check-ins →</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Open Incidents */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            🚨 Open Incidents
            {!loading && openIncidents.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{openIncidents.length}</span>
            )}
          </h2>
          {loading ? <div className="animate-pulse space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-slate-700/50 rounded-lg" />)}</div>
            : openIncidents.length === 0 ? <p className="text-slate-500 text-sm py-4 text-center">✅ No open incidents.</p>
            : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {openIncidents.slice(0, 6).map((inc: any) => (
                  <div key={inc.id} className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-300">{inc.category}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inc.status === 'IN_PROGRESS' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{inc.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{inc.description}</p>
                  </div>
                ))}
                {openIncidents.length > 6 && (
                  <a href="/dashboard/org/incidents" className="block text-center text-xs text-teal-400 hover:text-teal-300 pt-1">View all {openIncidents.length} →</a>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
