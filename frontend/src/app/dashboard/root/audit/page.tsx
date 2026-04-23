'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/audit`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setLogs(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">LOADING SECURE LOGS...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Global Audit Ledger</h1>
       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse font-mono text-sm">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-500">
               <th className="py-4 px-6">Timestamp</th>
               <th className="py-4 px-6">Actor ID</th>
               <th className="py-4 px-6">Action Executed</th>
               <th className="py-4 px-6">Target Sector</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {logs.length === 0 ? (
               <tr><td colSpan={4} className="py-8 text-center text-gray-500 italic">Ledger empty.</td></tr>
             ) : logs.map(log => (
               <tr key={log.id} className="hover:bg-gray-800/50">
                 <td className="py-4 px-6 text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                 <td className="py-4 px-6 text-blue-400">{log.actorId.substring(0, 8)}...</td>
                 <td className="py-4 px-6 text-yellow-400 font-bold">{log.action}</td>
                 <td className="py-4 px-6">{log.targetType} [{log.targetId.substring(0,6)}...]</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}

