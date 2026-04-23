'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchEvents = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/metrics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error('Events Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [router]);

  const handleEmergencyHalt = async (eventId: string) => {
    if (!confirm('EXTREME DANGER: This will instantly disconnect all live WebSockets for thousands of attendees. Execute?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/events/halt`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ eventId })
      });
      if (res.ok) alert(`Broadcast successful! Socket stream event_${eventId} terminated.`);
    } catch(e) { console.error(e); }
  };

  if (loading) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-blue-500 font-mono tracking-widest text-sm animate-pulse">AGGREGATING GLOBAL EVENT PACKETS...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <header className="flex justify-between items-end border-b border-gray-800 pb-6 mb-8">
         <div>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">Global Event Pipeline</h1>
           <p className="text-gray-500 mt-2 text-sm font-mono tracking-wide">Live Multi-Tenant Activity Monitoring</p>
         </div>
       </header>

       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-400 uppercase tracking-widest leading-loose">
               <th className="py-4 px-6 font-semibold">Event Target</th>
               <th className="py-4 px-6 font-semibold">Owning Tenant</th>
               <th className="py-4 px-6 font-semibold">Geofence Nodes</th>
               <th className="py-4 px-6 font-semibold">Time Horizon</th>
               <th className="py-4 px-6 text-right font-semibold">Emergency Protocols</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {events.length === 0 ? (
                <tr>
                   <td colSpan={5} className="py-8 text-center text-gray-500 bg-gray-900/20 italic font-mono text-sm">NO LIVE EVENTS DETECTED IN GLOBAL PIPELINE</td>
                </tr>
             ) : events.map(ev => (
               <tr key={ev.id} className="hover:bg-gray-800/50 transition-colors">
                 <td className="py-4 px-6">
                   <div className="font-semibold text-gray-200">{ev.name}</div>
                   <div className="text-xs text-gray-500 font-mono mt-1 pr-4 truncate max-w-[200px]">{ev.id}</div>
                 </td>
                 <td className="py-4 px-6 text-cyan-400 font-mono text-sm">
                   {ev.organization?.name || 'Unknown'}
                 </td>
                 <td className="py-4 px-6">
                   {ev.latitude && ev.longitude ? (
                     <span className="bg-green-500/10 text-green-400 font-mono text-xs px-2 py-1 rounded border border-green-500/20">
                       {ev.latitude.toFixed(2)}, {ev.longitude.toFixed(2)}
                     </span>
                   ) : (
                     <span className="text-gray-600 text-xs italic">UNMAPPED</span>
                   )}
                 </td>
                 <td className="py-4 px-6 text-sm text-gray-400 font-mono">
                   {new Date(ev.startTime).toLocaleDateString()}
                 </td>
                 <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => handleEmergencyHalt(ev.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded text-xs transition-colors font-semibold tracking-widest"
                    >
                      KILL SWITCH
                    </button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}

