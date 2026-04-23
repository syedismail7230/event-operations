'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OrgMetrics {
  activeEvents: number;
  totalAttendees: number;
  totalVolunteers: number;
  events?: any[];
  personnel?: any[];
  reports?: any[];
}

const KPI_CARDS = [
  { key: 'activeEvents',    label: 'Total Events',       icon: '📅', sub: 'Active & Upcoming',   color: 'from-blue-600/20 to-blue-700/10',    border: 'border-blue-500/20',  glow: 'bg-blue-500/10'    },
  { key: 'totalAttendees',  label: 'Total Attendees',    icon: '🎟️', sub: 'Approved registrations', color: 'from-teal-600/20 to-teal-700/10', border: 'border-teal-500/20',  glow: 'bg-teal-500/10'    },
  { key: 'totalVolunteers', label: 'Active Volunteers',  icon: '👷', sub: 'On-duty personnel',    color: 'from-purple-600/20 to-purple-700/10', border: 'border-purple-500/20', glow: 'bg-purple-500/10' },
];

const QUICK_LINKS = [
  { label: 'Create Event',           href: '/dashboard/org/events',    icon: '📅', color: 'bg-teal-600 hover:bg-teal-500' },
  { label: 'Approve Registrations',  href: '/dashboard/org/attendees', icon: '✅', color: 'bg-orange-600 hover:bg-orange-500' },
  { label: 'Assign Personnel',       href: '/dashboard/org/personnel', icon: '👷', color: 'bg-purple-600 hover:bg-purple-500' },
  { label: 'View Analytics',         href: '/dashboard/org/analytics', icon: '📊', color: 'bg-indigo-600 hover:bg-indigo-500' },
];

export default function OrgOverview() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    if (!['ORG_ADMIN', 'MANAGER'].includes(u.role)) { router.push('/login'); return; }
    setUser(u);

    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    updateTime();
    const interval = setInterval(updateTime, 1000);

    fetchOrgData(localStorage.getItem('token') || '');
    return () => clearInterval(interval);
  }, [router]);

  const fetchOrgData = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/org/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setMetrics(await res.json());
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex gap-1 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-8 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 150}ms` }}></div>
            ))}
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white font-sans space-y-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Organization Admin</p>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, <span className="bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0] || 'Admin'}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Executive Snapshot — Real-time operational status</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400 font-mono font-bold">LIVE</span>
          </div>
          <p className="font-mono text-lg text-slate-300">{currentTime}</p>
          <p className="text-xs text-slate-500">{new Date().toDateString()}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {KPI_CARDS.map(card => (
          <div key={card.key} className={`relative overflow-hidden bg-gradient-to-br ${card.color} border ${card.border} rounded-2xl p-6 group hover:scale-[1.01] transition-all duration-200`}>
            <div className={`absolute top-0 right-0 w-32 h-32 ${card.glow} rounded-full -mr-10 -mt-10 blur-2xl group-hover:opacity-150 transition-opacity`}></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{card.icon}</span>
                <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">{card.sub}</span>
              </div>
              <p className="text-4xl font-bold font-mono text-white mb-1">
                {(metrics as any)?.[card.key] ?? 0}
              </p>
              <p className="text-sm text-slate-400">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`${link.color} transition-all text-white text-sm font-semibold py-3 px-4 rounded-xl flex items-center gap-3 shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200`}
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Row: Upcoming Events + Recent Personnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span> Upcoming Events
            </h2>
            <Link href="/dashboard/org/events" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
          </div>
          {!metrics?.events?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <span className="text-3xl mb-2">📭</span>
              <p className="text-sm">No events found.</p>
              <Link href="/dashboard/org/events" className="text-xs text-teal-400 mt-2 hover:underline">Create your first event</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.events.slice(0, 4).map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700/40 hover:border-blue-500/20 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg shrink-0">📅</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 text-sm truncate">{ev.name}</p>
                    <p className="text-xs text-slate-500">{new Date(ev.startTime).toLocaleString()}</p>
                  </div>
                  <span className="px-2 py-1 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 shrink-0">Live</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Personnel */}
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="w-1.5 h-5 bg-purple-500 rounded-full"></span> Personnel Roster
            </h2>
            <Link href="/dashboard/org/personnel" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Manage →</Link>
          </div>
          {!metrics?.personnel?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <span className="text-3xl mb-2">👥</span>
              <p className="text-sm">No personnel assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {metrics.personnel.slice(0, 6).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold">
                      {p.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${p.role === 'VOLUNTEER' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

