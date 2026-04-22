'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

export default function BillingModule() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/dashboard/org/billing`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setData(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const plan = data?.subscription?.plan || 'STARTER';
  const PLAN_CONFIG: Record<string, { color: string; eventLimit: number; userLimit: number; price: string }> = {
    STARTER: { color: 'from-slate-600 to-slate-700', eventLimit: 5, userLimit: 50, price: 'Free' },
    PRO: { color: 'from-indigo-600 to-indigo-700', eventLimit: 50, userLimit: 500, price: '$49/mo' },
    ENTERPRISE: { color: 'from-teal-600 to-teal-700', eventLimit: -1, userLimit: -1, price: 'Custom' },
  };
  const config = PLAN_CONFIG[plan] || PLAN_CONFIG['STARTER'];

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-40 bg-slate-800/50 rounded-xl"></div><div className="h-40 bg-slate-800/50 rounded-xl"></div></div>;

  return (
    <div className="text-white font-sans">
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Billing & Limits</h1>
        <p className="text-sm text-slate-400 mt-1">Your organization's subscription plan and usage metrics.</p>
      </div>

      {/* Current Plan Card */}
      <div className={`bg-gradient-to-br ${config.color} border border-white/10 rounded-2xl p-6 mb-6`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-widest mb-1">Current Plan</p>
            <h2 className="text-3xl font-bold text-white">{plan}</h2>
            <p className="text-white/60 text-sm mt-1">{data?.org?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{config.price}</p>
            <p className="text-white/60 text-xs mt-1">per month</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-white/60 text-xs mb-1">Events</p>
            <p className="text-2xl font-bold font-mono">{data?.eventCount || 0} / {config.eventLimit === -1 ? '∞' : config.eventLimit}</p>
            {config.eventLimit > 0 && (
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2"><div className="bg-white rounded-full h-1.5" style={{ width: `${Math.min(100, ((data?.eventCount || 0) / config.eventLimit) * 100)}%` }}></div></div>
            )}
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-white/60 text-xs mb-1">Users</p>
            <p className="text-2xl font-bold font-mono">{data?.userCount || 0} / {config.userLimit === -1 ? '∞' : config.userLimit}</p>
            {config.userLimit > 0 && (
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2"><div className="bg-white rounded-full h-1.5" style={{ width: `${Math.min(100, ((data?.userCount || 0) / config.userLimit) * 100)}%` }}></div></div>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Details */}
      {data?.subscription ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Subscription Details</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Status', value: data.subscription.status || 'ACTIVE' },
              { label: 'Plan', value: data.subscription.plan },
              { label: 'Billing Cycle', value: data.subscription.billingCycle || 'Monthly' },
              { label: 'Started', value: new Date(data.subscription.startDate || data.org?.createdAt).toLocaleDateString() },
              { label: 'Next Renewal', value: data.subscription.endDate ? new Date(data.subscription.endDate).toLocaleDateString() : 'N/A' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-400">{row.label}</span>
                <span className="text-slate-200 font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 mb-6 text-center">
          <p className="text-slate-400 text-sm">No active subscription record found. You are on the <span className="text-teal-400 font-bold">Free Starter</span> plan.</p>
          <p className="text-slate-500 text-xs mt-2">Contact your Root Administrator to upgrade.</p>
        </div>
      )}

      {/* Upgrade Plans */}
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: 'Starter', price: 'Free', events: '5', users: '50', color: 'border-slate-600' },
          { name: 'Pro', price: '$49/mo', events: '50', users: '500', color: 'border-indigo-500/50', highlight: true },
          { name: 'Enterprise', price: 'Custom', events: 'Unlimited', users: 'Unlimited', color: 'border-teal-500/50' },
        ].map(p => (
          <div key={p.name} className={`border rounded-xl p-5 ${p.highlight ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-800/40 ' + p.color}`}>
            <p className="text-base font-bold text-white mb-1">{p.name}</p>
            <p className="text-2xl font-bold text-slate-200 mb-4">{p.price}</p>
            <ul className="space-y-1.5 text-xs text-slate-400 mb-4">
              <li>✓ {p.events} events</li>
              <li>✓ {p.users} users</li>
              <li>✓ Real-time features</li>
              <li>✓ AWS Aurora storage</li>
            </ul>
            <button className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${plan === p.name.toUpperCase() ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`} disabled={plan === p.name.toUpperCase()}>
              {plan === p.name.toUpperCase() ? 'Current Plan' : 'Contact Admin to Upgrade'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
