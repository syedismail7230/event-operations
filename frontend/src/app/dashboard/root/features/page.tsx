'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';

export default function FeatureTogglesPage() {
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToggles = async () => {
      try {
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/features', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setFeatures(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchToggles();
  }, []);

  const handleToggle = async (key: string, currentVal: boolean) => {
    try {
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/features/toggle', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, isEnabled: !currentVal })
      });
      if (res.ok) {
        setFeatures(features.map(f => f.key === key ? { ...f, isEnabled: !currentVal } : f));
      }
    } catch(e) { console.error(e); }
  };

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">FETCHING TOGGLE STATES...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold mb-8 border-b border-gray-800 pb-6 text-gray-300">Feature Toggles</h1>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {features.map(feature => (
           <div key={feature.id} className="bg-gray-800/40 p-6 rounded-xl border border-gray-700 shadow-xl flex justify-between items-center">
             <div>
               <h3 className="font-bold text-blue-400 font-mono">{feature.key}</h3>
               <p className="text-gray-500 text-xs mt-1">{feature.description || 'Global App Capability Switch'}</p>
             </div>
             <button
               onClick={() => handleToggle(feature.key, feature.isEnabled)}
               className={`px-4 py-2 rounded text-xs transition-colors font-bold ${feature.isEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}
             >
               {feature.isEnabled ? 'ENABLED' : 'DISABLED'}
             </button>
           </div>
         ))}
       </div>
    </div>
  );
}
