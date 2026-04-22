'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

export default function ProfileSettingsModule() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ orgName: '', name: '', phone: '' });
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/dashboard/org/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          setForm({ orgName: data.org?.name || '', name: data.user?.name || '', phone: data.user?.phone || '' });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch(`${API}/dashboard/org/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        // Update localStorage user name
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, name: data.user?.name }));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-40 bg-slate-800/50 rounded-xl"></div></div>;

  return (
    <div className="text-white font-sans">
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">Profile Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your personal profile and organization details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-600 to-rose-600 flex items-center justify-center text-3xl font-bold shadow-xl mb-4">
            {settings?.user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <p className="font-bold text-lg text-slate-100">{settings?.user?.name}</p>
          <p className="text-sm text-slate-500 mt-1">{settings?.user?.email}</p>
          <span className="mt-3 px-3 py-1 text-xs font-bold uppercase rounded border bg-pink-500/10 text-pink-400 border-pink-500/20">{settings?.user?.role}</span>
          <div className="mt-4 text-xs text-slate-500 space-y-1">
            <p>📞 {settings?.user?.phone || 'No phone set'}</p>
            <p>🏢 {settings?.org?.name}</p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-6 flex items-center gap-2"><span className="w-1.5 h-5 bg-pink-500 rounded-full"></span>Edit Profile</h2>
          <form onSubmit={handleSave} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-400 mb-1">Organization Name</label>
                <input type="text" value={form.orgName} onChange={e => setForm({...form, orgName: e.target.value})}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Your Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Phone Number</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  placeholder="+1234567890"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-400 mb-1">Email Address</label>
                <input type="email" value={settings?.user?.email || ''} disabled
                  className="w-full bg-slate-900/30 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-500 cursor-not-allowed" />
                <p className="text-xs text-slate-600 mt-1">Email cannot be changed. Contact Root Admin.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg transition-all">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span className="text-green-400 text-sm font-medium">✓ Saved successfully</span>}
            </div>
          </form>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">System Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
          {[
            { label: 'Organization ID', value: settings?.org?.id?.slice(0, 8) + '...' },
            { label: 'User ID', value: settings?.user?.id?.slice(0, 8) + '...' },
            { label: 'Created', value: settings?.org?.createdAt ? new Date(settings.org.createdAt).toLocaleDateString() : 'N/A' },
            { label: 'Infrastructure', value: 'AWS Aurora RDS' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
              <p className="text-slate-500 mb-1">{s.label}</p>
              <p className="text-slate-300 font-mono font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
