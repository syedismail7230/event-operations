'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/notifications`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setNotifs(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchNotifs();
  }, []);

  const handleBroadcast = async () => {
    if(!msg) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/notifications/broadcast`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ message: msg, type: 'URGENT' })
      });
      if (res.ok) {
        setNotifs([await res.json(), ...notifs]);
        setMsg('');
      }
    } catch(e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Global Notification Broadcast</h1>
       
       <div className="bg-gray-800/40 p-6 rounded-xl border border-blue-500/30 mb-8 flex gap-4">
         <input 
           type="text" 
           value={msg} 
           onChange={e => setMsg(e.target.value)} 
           placeholder="Enter global broadcast payload..." 
           className="bg-gray-900 border border-gray-700 rounded px-4 py-3 flex-1 text-sm font-mono text-cyan-400 focus:outline-none focus:border-blue-500"
         />
         <button onClick={handleBroadcast} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded transition-colors text-sm tracking-widest">
           BROADCAST
         </button>
       </div>

       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse font-mono text-sm">
           <tbody className="divide-y divide-gray-800/50">
             {notifs.map(n => (
               <tr key={n.id} className="hover:bg-gray-800/50">
                 <td className="py-4 px-6 text-yellow-400 w-32 shrink-0">{new Date(n.createdAt).toLocaleTimeString()}</td>
                 <td className="py-4 px-6 text-gray-300 w-full">{n.message}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}

