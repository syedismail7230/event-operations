'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';
const LOCATION_INTERVAL_MS = 15_000;


interface Notification {
  id: string;
  message: string;
  type: 'INFO' | 'URGENT';
  targetRole: string;
  sentAt: string;
  isNew?: boolean;
}

// ─── Notification Bell (inline for attendee) ───
function AttendeeNotificationBell({ orgId }: { orgId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    const token = localStorage.getItem('token');

    // Fetch history
    fetch(`${API}/dashboard/org/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Notification[]) => {
        setNotifications(data);
        setUnread(Math.min(data.length, 9));
      }).catch(() => {});

    // Real-time socket
    const socket: Socket = io(API, { auth: { token } });
    socket.emit('join_org_room', orgId);
    socket.on('org_notification', (msg: Notification) => {
      setNotifications(prev => [{ ...msg, isNew: true }, ...prev]);
      setUnread(prev => Math.min(prev + 1, 99));
    });
    return () => { socket.disconnect(); };
  }, [orgId]);

  const handleOpen = () => {
    setOpen(p => !p);
    if (!open) setUnread(0);
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg active:scale-95 transition-transform"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#ff6b35] text-white text-[10px] font-bold px-1 animate-bounce shadow-md">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-72 bg-[#1e222d] border border-slate-700/60 rounded-2xl shadow-2xl z-[200] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-bold text-white">Announcements</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{notifications.length} total</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                <p className="text-2xl mb-2">📢</p>
                <p>No announcements yet.</p>
              </div>
            ) : notifications.map((n, i) => (
              <div key={n.id || i} className={`px-4 py-3 ${n.isNew ? 'bg-orange-500/5' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 shrink-0 w-2 h-2 rounded-full ${n.type === 'URGENT' ? 'bg-red-500' : 'bg-[#ff6b35]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${n.type === 'URGENT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                        {n.type}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(n.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layout ───
export default function AttendeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [locStatus, setLocStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [orgId, setOrgId] = useState('');

  const checkLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setLocStatus('granted'),
        () => setLocStatus('denied'),
        { enableHighAccuracy: true }
      );
    } else {
      setLocStatus('denied');
    }
  };

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    checkLocation();

    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (u.organizationId) {
      setOrgId(u.organizationId);
    } else {
      // Fetch fresh user profile from server to get updated organizationId
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.organizationId) {
            setOrgId(data.organizationId);
            const updated = { ...u, organizationId: data.organizationId };
            localStorage.setItem('user', JSON.stringify(updated));
          }
        }).catch(() => {});
    }

    // ── Background GPS tracking — emits position to server so volunteer
    //    dashboards can see this attendee as Online with live location ──
    if (!u.id || !u.organizationId) return;

    const socket: Socket = io(API, { auth: { token } });
    socket.emit('join_org_room', u.organizationId);

    let watchId: number | null = null;
    let posCache: { lat: number; lng: number } | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const sendPos = (lat: number, lng: number) => {
      posCache = { lat, lng };
      socket.emit('location_update', { lat, lng, userId: u.id, orgId: u.organizationId });
    };

    if ('geolocation' in navigator) {
      const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
      navigator.geolocation.getCurrentPosition(
        (p) => sendPos(p.coords.latitude, p.coords.longitude),
        () => {},
        opts
      );
      watchId = navigator.geolocation.watchPosition(
        (p) => { posCache = { lat: p.coords.latitude, lng: p.coords.longitude }; },
        () => {},
        opts
      );
      // Heartbeat every 15s using cached position
      intervalId = setInterval(() => {
        if (posCache) sendPos(posCache.lat, posCache.lng);
      }, LOCATION_INTERVAL_MS);
    }

    return () => {
      socket.disconnect();
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (!mounted) return null;

  const navItems = [
    { href: '/attendee', icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ) },
    { href: '/attendee/ticket', icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ) },
    { href: '/attendee/map', icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ) },
    { href: '/attendee/profile', icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ) }
  ];

  if (locStatus !== 'granted') {
    return (
      <div className="flex h-screen bg-[#11131a] items-center justify-center p-6 text-center">
        <div className="bg-[#1e222d] p-8 rounded-3xl max-w-sm shadow-2xl border border-slate-800">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Location Required</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            For your safety and operational security, you must enable location services to access the event dashboard.
          </p>
          <button 
            onClick={checkLocation}
            className="w-full py-4 bg-[#ff6b35] hover:bg-[#e85a2b] text-white font-bold rounded-xl transition-colors shadow-[0_0_20px_rgba(255,107,53,0.3)]"
          >
            Grant Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-[#11131a] text-white font-sans overflow-hidden w-full">
      <div className="w-full h-full overflow-hidden relative flex flex-col bg-[#11131a]">

        {/* Main scrollable content area */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 pb-[88px]">
          {children}
        </div>


        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 w-full h-[88px] bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex justify-between items-center px-8 z-50">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="relative flex flex-col items-center justify-center w-14 h-full group">
                <div className={`transition-colors duration-300 ${isActive ? 'text-[#ff6b35]' : 'text-[#a1a1aa] group-hover:text-slate-400'}`}>
                  {item.icon}
                </div>
                {isActive && (
                  <div className="absolute bottom-6 w-5 h-1 bg-[#ff6b35] rounded-full transition-all duration-300" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
