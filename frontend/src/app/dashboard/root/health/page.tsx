'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/health', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setHealth(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!health) return <div className="p-8 text-gray-500 animate-pulse font-mono flex items-center h-screen justify-center text-sm">Pinging Mainframe...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Database & OS Telemetry</h1>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-gray-800/40 p-8 rounded-xl border border-gray-700 shadow-xl">
           <h3 className="text-gray-400 text-sm tracking-widest uppercase mb-4">PostgreSQL Query Latency</h3>
           <div className="text-5xl font-mono text-cyan-400 font-bold">{health.dbLatencyMs}ms</div>
           <p className="mt-2 text-xs text-gray-500">Round-trip Ping Time to AWS RDS</p>
         </div>
         <div className="bg-gray-800/40 p-8 rounded-xl border border-gray-700 shadow-xl">
           <h3 className="text-gray-400 text-sm tracking-widest uppercase mb-4">Free System Memory</h3>
           <div className="text-5xl font-mono text-green-400 font-bold">{(health.freeMemoryBytes / 1024 / 1024 / 1024).toFixed(2)} GB</div>
           <p className="mt-2 text-xs text-gray-500">Available Host RAM Capacity</p>
         </div>
       </div>
    </div>
  );
}
