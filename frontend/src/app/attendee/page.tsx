'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

export default function AttendeeHome() {
  const [user, setUser] = useState<any>({});
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    fetchEvents();

    // Load notifications
    const token = localStorage.getItem('token');
    if (token && u.organizationId) {
      fetch(`${API}/dashboard/org/notifications`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(data => { setNotifications(data); setUnread(Math.min(data.length, 9)); })
        .catch(() => {});

      const socket: Socket = io(API, { auth: { token } });
      socket.emit('join_org_room', u.organizationId);
      socket.on('org_notification', (msg: any) => {
        setNotifications(prev => [{ ...msg, isNew: true }, ...prev]);
        setUnread(prev => Math.min(prev + 1, 99));
      });
      return () => { socket.disconnect(); };
    }
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedEvent) return;
    setJoining(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/events/${selectedEvent.id}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        // Update user org ID if needed
        const updatedUser = { ...user, organizationId: data.organizationId, status: 'ACTIVE' };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        alert('Ticket purchased successfully! Check your tickets tab.');
        setSelectedEvent(null);
        router.push('/attendee/ticket');
      } else {
        alert(data.error || 'Failed to join event');
      }
    } catch (e) {
      alert('Error connecting to server');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="relative min-h-full pb-10 bg-[#11131a]">
      {/* Top Dark Background Area */}
      <div className="bg-[#1e222d] w-full px-6 pt-12 pb-16 rounded-b-[40px] relative">
        {/* Header: logo + bell + avatar */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-wide text-white">Zawr Events</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen(p => !p); if (!bellOpen) setUnread(0); }}
                className="relative flex items-center justify-center w-9 h-9 rounded-full bg-slate-700/60 border border-slate-600/40"
              >
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[#ff6b35] text-white text-[9px] font-bold px-1">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {/* Bell dropdown */}
              {bellOpen && (
                <div className="absolute right-0 top-11 w-72 bg-[#1a1f2e] border border-slate-700 rounded-2xl shadow-2xl z-[200] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <span className="text-sm font-bold text-white">Announcements</span>
                    <button onClick={() => setBellOpen(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-sm">
                        <p className="text-2xl mb-2">📢</p>
                        <p>No announcements yet.</p>
                      </div>
                    ) : notifications.map((n: any, i: number) => (
                      <div key={n.id || i} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.type === 'URGENT' ? 'bg-red-500' : 'bg-[#ff6b35]'}`} />
                          <div>
                            <p className="text-sm text-slate-200 leading-snug">{n.message}</p>
                            <div className="flex gap-2 mt-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${n.type === 'URGENT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>{n.type}</span>
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

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden relative border-2 border-[#1e222d] shadow-[0_0_0_2px_rgba(255,107,53,0.3)]">
              <img src={`https://ui-avatars.com/api/?name=${user.name || 'User'}&background=random`} alt="avatar" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#ff6b35] border-2 border-[#1e222d] rounded-full"></div>
            </div>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-1">Hello {user.name ? user.name.split(' ')[0] : 'Guest'}</p>
        <h1 className="text-3xl font-bold text-white mb-8">Discover Amazing Events</h1>

        {/* Search Bar */}
        <div className="bg-[#2a2f3d] rounded-2xl flex items-center px-4 py-3 border border-slate-700/50">
          <svg className="w-5 h-5 text-slate-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Find amazing events" 
            className="bg-transparent border-none text-slate-200 focus:outline-none w-full text-sm placeholder-slate-500"
          />
        </div>
      </div>

      {/* Main Content Area (Light grey/white) */}
      <div className="px-6 pt-8 bg-[#11131a] -mt-6">
        {/* Popular Events Header */}
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold text-white">Popular Events 🔥</h2>
          <button className="text-[#ff6b35] text-xs font-semibold hover:opacity-80">View All</button>
        </div>

        {/* Horizontal Scroll Cards */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 pt-2 snap-x">
          {loading ? (
            <div className="text-slate-500 w-full text-center py-10 animate-pulse">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-slate-500 w-full text-center py-10">No public events available right now.</div>
          ) : events.map(event => (
            <div 
              key={event.id} 
              onClick={() => setSelectedEvent(event)}
              className="min-w-[260px] bg-white rounded-3xl p-3 snap-center shadow-lg cursor-pointer transform transition-transform active:scale-95"
            >
              <div className="relative h-40 rounded-2xl overflow-hidden mb-4 bg-slate-800">
                <img src={event.image || `https://source.unsplash.com/random/800x600/?concert,${event.id}`} alt={event.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }} />
                <button className="absolute top-3 right-3 w-8 h-8 bg-slate-900/40 backdrop-blur-md rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
              </div>
              <h3 className="font-bold text-slate-900 text-lg leading-tight mb-2 px-1 truncate">{event.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 px-1 mb-2">
                <svg className="w-3.5 h-3.5 text-[#ff6b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                {new Date(event.startTime).toLocaleDateString()}
              </div>
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600 truncate max-w-[150px]">
                  <svg className="w-3.5 h-3.5 text-[#ff6b35] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  {event.organization?.name || 'Local Venue'}
                </div>
                <span className="text-[#ff6b35] font-bold text-sm">$0</span>
              </div>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div className="flex justify-between items-end mb-4 mt-2">
          <h2 className="text-lg font-bold text-white">Category Events ✨</h2>
          <button className="text-[#ff6b35] text-xs font-semibold hover:opacity-80">View All</button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
          <button className="whitespace-nowrap px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm shadow-sm flex items-center gap-2">
            🎵 Music Festival
          </button>
          <button className="whitespace-nowrap px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm shadow-sm flex items-center gap-2">
            🖼️ Festival Arts
          </button>
          <button className="whitespace-nowrap px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm shadow-sm flex items-center gap-2">
            ⬛ Techno
          </button>
        </div>
      </div>

      {/* Detail Modal / Overlay */}
      {selectedEvent && (
        <div className="absolute inset-0 z-50 bg-[#11131a] flex flex-col h-[100dvh] w-full animation-slide-up sm:h-full sm:absolute">
          {/* Top Image Header */}
          <div className="relative h-2/5 w-full shrink-0 bg-slate-800">
            <img src={selectedEvent.image || `https://source.unsplash.com/random/800x600/?concert,${selectedEvent.id}`} alt={selectedEvent.name} className="w-full h-full object-cover grayscale-[30%]" onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }} />
            <div className="absolute top-10 w-full flex justify-between px-6">
              <button onClick={() => setSelectedEvent(null)} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white cursor-pointer z-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-red-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </button>
            </div>
            {/* Fade to white card */}
            <div className="absolute bottom-0 w-full h-12 bg-gradient-to-t from-white to-transparent"></div>
          </div>

          {/* Details Card */}
          <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-6 pt-6 pb-24 overflow-y-auto no-scrollbar relative shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            <div className="flex justify-between items-start mb-6">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight w-2/3">{selectedEvent.name}</h1>
              <span className="bg-[#ff6b35] text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md">
                $0 Free
              </span>
            </div>

            <div className="flex justify-between items-center mb-8">
              <span className="text-slate-500 text-sm font-medium">{selectedEvent._count?.personnel || 0} People are joined:</span>
              <div className="flex -space-x-2">
                 <img className="w-7 h-7 rounded-full border-2 border-white" src="https://i.pravatar.cc/100?img=1" alt=""/>
                 <img className="w-7 h-7 rounded-full border-2 border-white" src="https://i.pravatar.cc/100?img=2" alt=""/>
                 <img className="w-7 h-7 rounded-full border-2 border-white" src="https://i.pravatar.cc/100?img=3" alt=""/>
                 <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-900 text-[9px] text-white flex items-center justify-center font-bold">+11k</div>
              </div>
            </div>

            <h3 className="text-slate-900 font-bold mb-2">Description</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              {selectedEvent.description || 'No description provided.'} <span className="text-[#ff6b35] font-semibold cursor-pointer">...Read more</span>
            </p>

            <div className="space-y-4 mb-24">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-[#ff6b35]">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-slate-500 text-xs">Event Organization</p>
                  <p className="text-slate-900 font-bold text-sm">{selectedEvent.organization?.name || 'Local Venue'}</p>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-[#ff6b35]">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-slate-500 text-xs">{new Date(selectedEvent.startTime).toLocaleDateString()}</p>
                  <p className="text-slate-900 font-bold text-sm">
                    {new Date(selectedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                    {new Date(selectedEvent.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>

            {/* Bottom Floating Buy Action */}
            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white to-transparent">
              <button 
                disabled={joining}
                className="w-full bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl transition-all"
                onClick={handleJoin}
              >
                {joining ? 'Processing...' : `Get Ticket $0`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .animation-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}} />
    </div>
  );
}

