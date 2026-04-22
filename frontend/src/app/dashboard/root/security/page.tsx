'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function SecurityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/security', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setEvents(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">ANALYZING SECURITY ANOMALIES...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Security & Authentication Intercepts</h1>
       <div className="bg-gray-800/40 rounded-xl border border-red-500/30 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse font-mono text-sm">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-500">
               <th className="py-4 px-6">Incident Time</th>
               <th className="py-4 px-6 text-red-400">Severity Match</th>
               <th className="py-4 px-6">Target Profile ID</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {events.length === 0 ? (
               <tr><td colSpan={3} className="py-8 text-center text-green-500 italic">No Security Breaches Detected.</td></tr>
             ) : events.map(ev => (
               <tr key={ev.id} className="hover:bg-red-900/20">
                 <td className="py-4 px-6 text-gray-400">{new Date(ev.createdAt).toLocaleString()}</td>
                 <td className="py-4 px-6 text-red-500 font-bold">{ev.action}</td>
                 <td className="py-4 px-6 text-gray-500">{ev.targetId}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}
