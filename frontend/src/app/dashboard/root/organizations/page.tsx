'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'ROOT_ADMIN') {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/metrics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setOrgs(data.organizations || []);
        }
      } catch (error) {
        console.error('Error fetching org data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleToggleStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to ${newStatus === 'SUSPENDED' ? 'SUSPEND' : 'ACTIVATE'} this tenant? All active users and event operators under this tenant will instantly lose operational access.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/organization/suspend', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orgId, status: newStatus })
      });
      
      if (res.ok) {
        setOrgs(orgs.map(org => org.id === orgId ? { ...org, status: newStatus } : org));
        alert(`Tenant critically ${newStatus}`);
      } else {
        alert('Failed to execute governance action');
      }
    } catch (error) {
      console.error('Governance Error:', error);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-teal-500 font-mono">LOADING TENANT MATRIX...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6">
         <div>
           <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">Tenant Organizations Management</h1>
           <p className="text-gray-500 mt-2 text-sm font-mono tracking-wide">Enterprise SaaS Governance / Core Directory</p>
         </div>
       </div>

       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-400 uppercase tracking-widest leading-loose">
               <th className="py-4 px-6 font-semibold">Tenant Name</th>
               <th className="py-4 px-6 font-semibold">Total Users</th>
               <th className="py-4 px-6 font-semibold">Active Events</th>
               <th className="py-4 px-6 font-semibold">Subscription Plan</th>
               <th className="py-4 px-6 font-semibold">Status</th>
               <th className="py-4 px-6 text-right font-semibold">Governance Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {orgs.length === 0 ? (
                <tr>
                   <td colSpan={6} className="py-8 text-center text-gray-500 bg-gray-900/20 italic">No Organizations Registered</td>
                </tr>
             ) : orgs.map(org => (
               <tr key={org.id} className="hover:bg-gray-800/50 transition-colors">
                 <td className="py-4 px-6">
                   <div className="font-semibold text-gray-200">{org.name}</div>
                   <div className="text-xs text-gray-500 font-mono mt-1 pr-4 truncate max-w-[200px]">{org.id}</div>
                 </td>
                 <td className="py-4 px-6">
                   <span className="bg-teal-500/10 text-teal-400 font-mono px-3 py-1 rounded border border-teal-500/20">
                     {org._count.users}
                   </span>
                 </td>
                 <td className="py-4 px-6">
                   <span className="bg-blue-500/10 text-blue-400 font-mono px-3 py-1 rounded border border-blue-500/20">
                     {org._count.events}
                   </span>
                 </td>
                 <td className="py-4 px-6 text-sm text-gray-300">
                   {org.subscriptionId ? 'Premium SaaS' : 'Trial Edition'}
                 </td>
                 <td className="py-4 px-6">
                   {org.status === 'SUSPENDED' ? (
                      <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 w-max px-3 py-1 rounded-full border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span> Suspended
                      </div>
                   ) : (
                      <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 w-max px-3 py-1 rounded-full border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Active
                      </div>
                   )}
                 </td>
                 <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => handleToggleStatus(org.id, org.status || 'ACTIVE')} 
                      className={`px-4 py-2 rounded text-xs transition-colors font-semibold tracking-wider border ${org.status === 'SUSPENDED' ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400' : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400'}`}
                    >
                      {org.status === 'SUSPENDED' ? 'ACTIVATE' : 'SUSPEND'}
                    </button>
                    <button onClick={() => router.push(`/dashboard/root/organizations/${org.id}`)} className="ml-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-4 py-2 rounded text-xs transition-colors font-semibold tracking-wider">
                      MANAGE
                    </button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}
