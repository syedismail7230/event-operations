'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ActiveEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/login'); return; }

        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/public/events', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchEvents();
  }, [router]);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm min-h-screen bg-[#0b0f19] flex items-center justify-center">SYNCING GLOBAL EVENT POOL...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans max-w-6xl mx-auto">
       <header className="mb-12 border-b border-gray-800 pb-6 flex justify-between items-end">
         <div>
           <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent mb-2">Live Ongoing Events</h1>
           <p className="text-gray-500 font-mono text-sm">Real-time public events directory</p>
         </div>
         <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-red-400 hover:text-red-300 text-sm font-semibold tracking-wider transition-colors border border-red-500/30 bg-red-500/10 px-4 py-2 rounded">LOGOUT</button>
       </header>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         {events.length === 0 ? (
            <div className="col-span-full py-16 text-center border rounded-xl border-gray-800 bg-gray-900/50">
              <span className="text-gray-500 italic">No events pinging at this time.</span>
            </div>
         ) : events.map(ev => (
           <div key={ev.id} className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden hover:border-teal-500/50 transition-colors group cursor-pointer">
             <div className="h-32 bg-gradient-to-br from-indigo-900/50 to-teal-900/50 p-6 flex flex-col justify-end relative">
                <span className="absolute top-4 right-4 bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-bold px-2 py-1 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.2)]">LIVE</span>
                <h3 className="text-xl font-bold text-white z-10">{ev.name}</h3>
             </div>
             <div className="p-6">
                <p className="text-sm border-b border-gray-800 pb-4 mb-4 text-gray-400">{ev.description || "No description provided."}</p>
                <div className="flex justify-between items-center text-xs font-mono text-gray-500">
                  <span className="truncate w-3/4">HOST: {ev.organization?.name || 'Independent'}</span>
                  <span>{new Date(ev.startTime).toLocaleDateString()}</span>
                </div>
             </div>
           </div>
         ))}
       </div>
    </div>
  );
}
