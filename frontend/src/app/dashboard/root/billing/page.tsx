'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/billing`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setSubs(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSubs();
  }, []);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">FETCHING NATIVE LEDGER...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Monetization & Internal Ledger</h1>
       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse font-mono text-sm">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-500">
               <th className="py-4 px-6">Tenant Name</th>
               <th className="py-4 px-6">Plan Level</th>
               <th className="py-4 px-6">Status</th>
               <th className="py-4 px-6 font-bold text-green-400">Monthly Revenue</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {subs.length === 0 ? (
               <tr><td colSpan={4} className="py-8 text-center text-gray-500 italic">No Active Ledger Accounts.</td></tr>
             ) : subs.map(sub => (
               <tr key={sub.id} className="hover:bg-gray-800/50">
                 <td className="py-4 px-6 text-blue-400">{sub.organization?.name || 'Unknown'}</td>
                 <td className="py-4 px-6 text-gray-300">{sub.planLevel}</td>
                 <td className="py-4 px-6">
                    {sub.status === 'ACTIVE' ? <span className="text-green-500 bg-green-500/10 px-2 py-1 rounded">ACTIVE</span> : <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded">DELINQUENT</span>}
                 </td>
                 <td className="py-4 px-6 text-green-400 font-bold">${sub.mrrAmount}.00 / mo</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}

