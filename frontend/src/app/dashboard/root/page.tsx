'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const GeoMap = dynamic<{ points: any[] }>(() => import('../../../components/Map'), { ssr: false });

export default function RootDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<any>(null);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
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
        const [metricsRes, pendingRes] = await Promise.all([
          fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/metrics', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/pending-users', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (metricsRes.ok) setMetrics(await metricsRes.json());
        if (pendingRes.ok) setPendingUsers(await pendingRes.json());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleApprove = async (userId: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/approve-user', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        setPendingUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        alert('Failed to approve user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-white">Loading Command Center...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent">Global Command Center</h1>
        <div className="flex items-center gap-4">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(2ef,68,68,0.2)]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {metrics?.systemAlerts || 0} Alerts
          </div>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors border border-gray-700">Logout</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800/40 p-6 rounded-xl border border-gray-700 backdrop-blur-sm shadow-xl">
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Total Tenants</h3>
          <p className="text-3xl font-bold text-teal-400">{metrics?.totalOrgs || 0}</p>
        </div>
        <div className="bg-gray-800/40 p-6 rounded-xl border border-gray-700 backdrop-blur-sm shadow-xl">
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Active Users</h3>
          <p className="text-3xl font-bold text-indigo-400">{metrics?.activeUsers || 0}</p>
        </div>
        <div className="bg-gray-800/40 p-6 rounded-xl border border-gray-700 backdrop-blur-sm shadow-xl">
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Live Events</h3>
          <p className="text-3xl font-bold text-orange-400">{metrics?.activeEvents || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-teal-500/30 p-6 rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.1)]">
          <h3 className="text-teal-500/70 text-xs font-semibold uppercase tracking-widest mb-3">System Load</h3>
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-gray-400">CPU</span>
            <span className="text-teal-400 font-mono">{metrics?.systemLoad?.cpu}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-gray-400">Memory</span>
            <span className="text-teal-400 font-mono">{metrics?.systemLoad?.memory}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">API Hits / Hr</span>
            <span className="text-teal-400 font-mono">{metrics?.systemLoad?.apiHits}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-6 shadow-xl">
           <h2 className="text-xl font-semibold mb-6 text-gray-200">Registered SaaS Organizations</h2>
           {metrics?.organizations?.length === 0 ? (
             <p className="text-gray-500">No organizations found.</p>
           ) : (
             <div className="space-y-4">
               {metrics?.organizations?.map((org: any) => (
                 <div key={org.id} className="flex justify-between items-center p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <div>
                      <h4 className="font-semibold text-gray-200">{org.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">ID: {org.id}</p>
                    </div>
                    <div className="text-right flex gap-6">
                       <div className="flex flex-col items-center">
                         <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Users</span>
                         <span className="text-teal-400 font-semibold">{org._count.users}</span>
                       </div>
                       <div className="flex flex-col items-center">
                         <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Events</span>
                         <span className="text-indigo-400 font-semibold">{org._count.events}</span>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>

        <div className="space-y-8">
          <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 text-gray-200">Pending Organization Approvals</h2>
            
            {pendingUsers.length === 0 ? (
              <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800/50 text-center text-gray-500">
                No organizations are currently awaiting approval.
              </div>
            ) : (
              <div className="space-y-4">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="flex justify-between items-center p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                      <div>
                        <p className="text-sm font-semibold text-gray-200">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-1">{user.name}</p>
                      </div>
                      <button 
                        onClick={() => handleApprove(user.id)}
                        className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-lg hover:shadow-teal-500/25"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-6 shadow-xl overflow-hidden relative">
            <h2 className="text-xl font-semibold mb-6 text-gray-200">Global Geolocation Density</h2>
            <div className="h-64 rounded-lg bg-gray-900 border border-gray-800 relative flex items-center justify-center p-1">
               <GeoMap points={metrics?.mapNodes || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
