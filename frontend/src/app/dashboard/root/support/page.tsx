'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/support', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setTickets(await res.json());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchTickets();
  }, []);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">FETCHING QUEUE...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Tenant Support Queue</h1>
       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse font-mono text-sm">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-500">
               <th className="py-4 px-6">Tenant Match</th>
               <th className="py-4 px-6">Subject</th>
               <th className="py-4 px-6">Priority</th>
               <th className="py-4 px-6">State</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {tickets.length === 0 ? (
               <tr><td colSpan={4} className="py-8 text-center text-gray-500 italic">No tickets in internal array.</td></tr>
             ) : tickets.map(t => (
               <tr key={t.id} className="hover:bg-gray-800/50">
                 <td className="py-4 px-6 text-cyan-400">{t.tenantId}</td>
                 <td className="py-4 px-6 text-gray-300">{t.subject}</td>
                 <td className="py-4 px-6 font-bold">{t.priority}</td>
                 <td className="py-4 px-6 text-yellow-400">{t.status}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}
