'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

export default function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await fetch(`${API}/dashboard/root/organization/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setOrg(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, [id]);

  if (loading) return <div className="text-gray-500 font-mono p-8 animate-pulse text-sm">LOADING DEEP TENANT CONTEXT...</div>;
  if (!org) return <div className="p-8 text-red-500">Tenant structure missing.</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <button onClick={() => router.push('/dashboard/root/organizations')} className="text-gray-500 hover:text-white transition-colors mb-6 font-mono text-sm tracking-widest flex items-center gap-2">
         ← BACK TO MASTER DIRECTORY
       </button>
       
       <header className="mb-8 border-b border-gray-800 pb-6 flex items-end justify-between">
         <div className="flex flex-col">
           <h1 className="text-4xl font-bold text-teal-400 capitalize">{org.name}</h1>
           <span className="text-gray-500 font-mono text-xs mt-2">{org.id}</span>
         </div>
         <div className="text-right">
           <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${org.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
             {org.status}
           </div>
         </div>
       </header>

       <div className="mb-8 p-6 bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl grid grid-cols-3 gap-6">
         <div><p className="text-gray-500 text-xs font-mono uppercase">Subscription Id</p><p className="text-blue-400 font-mono truncate">{org.subscriptionId || 'TRIAL_TIER'}</p></div>
         <div><p className="text-gray-500 text-xs font-mono uppercase">Users Tracked</p><p className="text-white font-mono">{org.users?.length || 0}</p></div>
         <div><p className="text-gray-500 text-xs font-mono uppercase">Events Hosted</p><p className="text-white font-mono">{org.events?.length || 0}</p></div>
       </div>

       <div className="grid grid-cols-2 gap-8">
         <div className="bg-gray-800/20 rounded border border-gray-800 p-6">
           <h3 className="text-cyan-500 font-bold mb-4 border-b border-gray-700 pb-2">Active IAM Identities</h3>
           <ul className="space-y-2">
             {org.users?.map((u: any) => (
                <li key={u.id} className="flex justify-between text-sm py-2 px-3 bg-gray-900/50 rounded font-mono">
                  <span className="text-gray-300 truncate w-1/2">{u.email}</span>
                  <span className={`text-xs px-2 rounded font-bold flex items-center ${u.role === 'ORG_ADMIN' ? 'text-teal-400' : 'text-gray-500'}`}>{u.role}</span>
                </li>
             ))}
           </ul>
         </div>

         <div className="bg-gray-800/20 rounded border border-gray-800 p-6">
           <h3 className="text-purple-500 font-bold mb-4 border-b border-gray-700 pb-2">Tenant Events Node</h3>
           <ul className="space-y-2">
             {org.events?.map((ev: any) => (
                <li key={ev.id} className="flex flex-col text-sm py-2 px-3 bg-gray-900/50 rounded">
                  <span className="text-gray-300 font-bold">{ev.name}</span>
                  <span className="text-gray-600 font-mono text-xs">{new Date(ev.startTime).toLocaleDateString()}</span>
                </li>
             ))}
           </ul>
         </div>
       </div>
    </div>
  );
}
