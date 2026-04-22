'use client';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

interface Notification {
  id: string;
  message: string;
  type: 'INFO' | 'URGENT';
  targetRole: string;
  sentAt: string;
  isNew?: boolean;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  // Fetch historical notifications on mount
  useEffect(() => {
    if (!token || !user?.organizationId) return;

    fetch(`${API}/dashboard/org/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.ok ? res.json() : [])
      .then((data: Notification[]) => {
        setNotifications(data);
        setUnread(data.length > 0 ? Math.min(data.length, 9) : 0);
      })
      .catch(() => {});

    // Setup socket for real-time incoming notifications
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);

    socket.on('org_notification', (msg: Notification) => {
      setNotifications(prev => [{ ...msg, isNew: true }, ...prev]);
      setUnread(prev => Math.min(prev + 1, 99));
    });

    return () => { socket.disconnect(); };
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(prev => !prev);
    if (!open) setUnread(0); // mark all read when opening
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200">Notifications</h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{notifications.length} total</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                <p className="text-2xl mb-2">🔔</p>
                <p>No notifications yet.</p>
              </div>
            ) : notifications.map((n, i) => (
              <div key={n.id || i} className={`px-4 py-3 hover:bg-slate-800/50 transition-colors ${n.isNew ? 'bg-blue-500/5' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${n.type === 'URGENT' ? 'bg-red-500' : 'bg-blue-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${n.type === 'URGENT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                        {n.type}
                      </span>
                      <span className="text-[10px] text-slate-500">{new Date(n.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
