'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

interface Attendee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  lastCheckIn?: { direction: string; timestamp: string; event: { name: string } };
}

export default function VolunteerAttendeesPage() {
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [livePositions, setLivePositions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    fetchAttendees();

    // Setup Socket for live positions
    const socket = io(API, { auth: { token } });
    socket.emit('join_org_room', user.organizationId);
    socket.emit('get_live_positions', user.organizationId);
    
    socket.on('live_positions_snapshot', (positions: any[]) => {
      const map: Record<string, any> = {};
      positions.forEach(p => { if (p.user?.id) map[p.user.id] = p; });
      setLivePositions(map);
    });

    socket.on('user_location', (data: any) => {
      setLivePositions(prev => ({ ...prev, [data.userId]: data }));
    });

    return () => { socket.disconnect(); };
  }, []);

  const fetchAttendees = async () => {
    try {
      const res = await fetch(`${API}/dashboard/org/users`, { headers: { Authorization: `Bearer ${token}` } });
      const checkinsRes = await fetch(`${API}/dashboard/org/checkins`, { headers: { Authorization: `Bearer ${token}` } });
      
      if (res.ok) {
        const users = await res.json();
        const checkins = checkinsRes.ok ? await checkinsRes.json() : [];

        // Map latest check-in per user
        const latestCI: Record<string, any> = {};
        (checkins as any[]).forEach((ci: any) => {
          if (!latestCI[ci.userId] || new Date(ci.timestamp) > new Date(latestCI[ci.userId].timestamp)) {
            latestCI[ci.userId] = ci;
          }
        });

        // Filter out only attendees if needed, or keep everyone to track all personnel too.
        // Assuming we want everyone for full visibility, or just role === 'ATTENDEE'.
        const eventAttendees = users.filter((u: any) => u.role === 'ATTENDEE' || u.role === 'USER' || u.role === 'VOLUNTEER');

        setAttendees(eventAttendees.map((u: any) => ({
          ...u,
          lastCheckIn: latestCI[u.id] || null,
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getStatus = (a: Attendee) => {
    const livePos = livePositions[a.id];
    const isOnline = livePos && (Date.now() - new Date(livePos.updatedAt).getTime() < 120_000);
    const checkedIn = a.lastCheckIn?.direction === 'IN';
    return { isOnline, checkedIn, livePos };
  };

  const filtered = attendees.filter(a => 
    !filter || 
    a.name.toLowerCase().includes(filter.toLowerCase()) || 
    a.email.toLowerCase().includes(filter.toLowerCase()) ||
    a.phone?.includes(filter)
  );

  return (
    <div className="text-white font-sans p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-6">
        <div>
          <button onClick={() => router.back()} className="text-teal-400 hover:text-teal-300 text-sm mb-2 flex items-center gap-1">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
            👥 Master Attendee List
          </h1>
          <p className="text-sm text-slate-400 mt-1">Full roster of all event attendees and personnel.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search name, phone..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
          />
          <button onClick={fetchAttendees} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Table & Mobile Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700/50 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 font-semibold">Attendee</th>
                <th className="p-4 font-semibold">Contact Info</th>
                <th className="p-4 font-semibold">Emergency / Team</th>
                <th className="p-4 font-semibold text-center">Check-In Status</th>
                <th className="p-4 font-semibold text-center">Geo-Fence Status</th>
                <th className="p-4 font-semibold text-right">Live Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 animate-pulse">Loading roster...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No attendees found.</td>
                </tr>
              ) : (
                filtered.map(a => {
                  const { isOnline, checkedIn, livePos } = getStatus(a);
                  const isInsideGeo = livePos?.isInsideGeo;
                  const mapsLink = livePos ? `https://www.google.com/maps/search/?api=1&query=${livePos.lat},${livePos.lng}` : null;

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isOnline ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/40' : 'bg-slate-700 text-slate-400'
                          }`}>
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">{a.name}</p>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{a.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300 text-xs space-y-2">
                        <div>
                          {a.phone ? (
                            <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 rounded-md transition-colors text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              Call {a.phone}
                            </a>
                          ) : (
                            <span className="text-slate-600 italic">No phone</span>
                          )}
                        </div>
                        <p className="text-slate-500">{a.email}</p>
                      </td>
                      <td className="p-4 text-slate-300 text-xs space-y-1">
                        <p>Emergency: <span className="text-slate-500 italic">N/A</span></p>
                        <p>Team: <span className="text-slate-500 italic">Unassigned</span></p>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          checkedIn ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {checkedIn ? '✓ CHECKED IN' : '○ CHECKED OUT'}
                        </span>
                        {a.lastCheckIn && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            {new Date(a.lastCheckIn.timestamp).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {isOnline ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isInsideGeo === false ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' :
                            isInsideGeo === true ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {isInsideGeo === false ? '⚠️ OUTSIDE ZONE' : isInsideGeo === true ? '📍 INSIDE ZONE' : '📡 LIVE'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">Offline</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {mapsLink ? (
                          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors">
                            Map ↗
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">No GPS Data</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-slate-800/80">
          {loading ? (
            <div className="p-8 text-center text-slate-500 animate-pulse text-sm">Loading roster...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No attendees found.</div>
          ) : (
            filtered.map(a => {
              const { isOnline, checkedIn, livePos } = getStatus(a);
              const isInsideGeo = livePos?.isInsideGeo;
              const mapsLink = livePos ? `https://www.google.com/maps/search/?api=1&query=${livePos.lat},${livePos.lng}` : null;

              return (
                <div key={a.id} className="p-4 flex flex-col gap-4">
                  {/* Header: Avatar, Name, Role, Online Status */}
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isOnline ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/40' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200 text-sm">{a.name}</p>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400">{a.role}</span>
                      </div>
                    </div>
                    {isOnline ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isInsideGeo === false ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' :
                        isInsideGeo === true ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {isInsideGeo === false ? '⚠️ OUTSIDE' : isInsideGeo === true ? '📍 INSIDE' : '📡 LIVE'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Offline</span>
                    )}
                  </div>

                  {/* Contact Info & Check-in */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-800/30 p-3 rounded-xl border border-slate-800/50">
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Contact</p>
                      {a.phone ? (
                        <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 text-green-400 font-medium hover:text-green-300">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                          {a.phone}
                        </a>
                      ) : (
                        <span className="text-slate-600 italic block">No phone</span>
                      )}
                      <p className="text-slate-400 truncate pr-2">{a.email}</p>
                    </div>
                    
                    <div className="space-y-1.5 flex flex-col items-end">
                      <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Check-in</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        checkedIn ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {checkedIn ? '✓ IN' : '○ OUT'}
                      </span>
                      {a.lastCheckIn && (
                        <span className="text-[10px] text-slate-500">{new Date(a.lastCheckIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {mapsLink && (
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" 
                      className="w-full flex justify-center items-center gap-2 mt-1 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 py-2.5 rounded-xl transition-all font-semibold border border-blue-500/20 active:scale-[0.98]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                      Open in Google Maps
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
