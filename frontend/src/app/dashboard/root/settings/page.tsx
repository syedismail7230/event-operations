'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/settings`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setSettings(await res.json());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchSettings();
  }, []);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">LOADING CONFIG...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Global Platform Configurations</h1>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {settings.length === 0 ? (
             <div className="col-span-2 text-center py-12 text-gray-500 italic border border-gray-800 rounded bg-gray-900/50">Core environment overrides empty. Running on factory defaults.</div>
         ) : settings.map(set => (
           <div key={set.id} className="bg-gray-800/40 p-6 rounded-xl border border-gray-700 shadow-xl flex flex-col justify-between items-start">
             <h3 className="font-bold text-gray-300 font-mono text-sm">{set.key}</h3>
             <input type="text" readOnly value={set.value} className="mt-4 bg-gray-900 border border-gray-700 rounded px-4 py-2 w-full text-blue-400 font-mono text-sm focus:outline-none" />
           </div>
         ))}
       </div>
    </div>
  );
}

