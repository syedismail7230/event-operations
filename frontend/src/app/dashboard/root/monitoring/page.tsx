'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NOCMonitoringPage() {
  const router = useRouter();
  const [telemetry, setTelemetry] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/metrics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data.systemLoad);
        }
      } catch (error) {
        console.error('NOC Error:', error);
      }
    };

    // Poll every 3 seconds for live architectural monitoring
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [router]);

  if (!telemetry) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-cyan-500 font-mono tracking-widest text-sm animate-pulse">ESTABLISHING NOC SECURE UPLINK...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans overflow-hidden relative">
      {/* Decorative NOC Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <header className="flex justify-between items-end border-b border-cyan-500/20 pb-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-cyan-400 tracking-tighter uppercase font-mono shadow-cyan-500/50 hover:text-cyan-300 transition-colors">NETWORK OPERATIONS CENTER</h1>
            <p className="text-cyan-600 font-mono text-xs tracking-[0.2em] mt-1">REAL-TIME MULTI-TENANT SYSTEM TELEMETRY</p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
              <span className="text-cyan-400 font-mono text-sm uppercase tracking-wider">Uplink Stable</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main CPU Telemetry */}
          <div className="bg-gray-900 border border-cyan-900 rounded shadow-[0_0_15px_rgba(8,145,178,0.1)] p-6 flex flex-col justify-between">
            <h2 className="text-cyan-500/50 text-xs font-black uppercase tracking-widest mb-4">Core CPU Utilization</h2>
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-[20px] bg-cyan-500/20"></div>
                <div className="w-32 h-32 border-4 border-cyan-900 rounded-full flex flex-col items-center justify-center relative z-10 bg-gray-900 shadow-[inset_0_0_20px_rgba(8,145,178,0.2)]">
                  <span className="text-4xl font-black text-cyan-300 tracking-tighter">{telemetry.cpu}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Heap */}
          <div className="bg-gray-900 border border-purple-900 rounded shadow-[0_0_15px_rgba(147,51,234,0.1)] p-6">
            <h2 className="text-purple-500/50 text-xs font-black uppercase tracking-widest mb-4">Memory Heap Allocation</h2>
            <div className="h-full flex flex-col justify-center">
               <div className="text-4xl font-black text-purple-400 tracking-tighter mb-2">{telemetry.memory.split('/')[0]}</div>
               <div className="text-purple-500/60 font-mono text-xs uppercase tracking-widest border-t border-purple-900 pt-2">Total Node Horizon: {telemetry.memory.split('/')[1]}</div>
            </div>
          </div>

          {/* API Hits Tracker */}
          <div className="bg-gray-900 border border-green-900 rounded shadow-[0_0_15px_rgba(34,197,94,0.1)] p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
             </div>
             <h2 className="text-green-500/50 text-xs font-black uppercase tracking-widest mb-4">Global API Traffic</h2>
             <div className="h-full flex flex-col justify-center">
               <div className="text-5xl font-black text-green-400 tracking-tighter mb-2 animate-pulse">{telemetry.apiHits.toLocaleString()}</div>
               <div className="text-green-500/60 font-mono text-xs uppercase tracking-widest border-t border-green-900 pt-2">Packets Processed Live</div>
             </div>
          </div>
        </div>

        {/* Global Security Subsystem Warning */}
        <div className="mt-8 border border-gray-800 bg-gray-900/50 p-6 rounded flex items-center justify-between">
           <div>
             <h3 className="text-yellow-500 font-mono font-bold tracking-widest text-sm">ARCHITECTURAL WARNING</h3>
             <p className="text-gray-500 font-mono text-xs mt-2 uppercase tracking-wide">Detailed WebSocket tracing and Stripe Webhook latency streams are offline. Premium Subscriptions module required for deep execution level tracing.</p>
           </div>
        </div>
      </div>
    </div>
  );
}

