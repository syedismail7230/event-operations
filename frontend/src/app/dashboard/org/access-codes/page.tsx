'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

interface AccessCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
  event: { id: string; name: string };
  creator: { id: string; name: string };
}

export default function AccessCodesPage() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ eventId: '', maxUses: '100', expiresAt: '' });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [codesRes, eventsRes] = await Promise.all([
        fetch(`${API}/dashboard/org/access-codes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/events`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (codesRes.ok) setCodes(await codesRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch(`${API}/dashboard/org/access-codes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: form.eventId, maxUses: parseInt(form.maxUses), expiresAt: form.expiresAt || undefined })
      });
      if (res.ok) { setShowCreate(false); setForm({ eventId: '', maxUses: '100', expiresAt: '' }); fetchAll(); }
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this access code?')) return;
    await fetch(`${API}/dashboard/org/access-codes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchAll();
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const usagePercent = (c: AccessCode) => Math.round((c.usedCount / c.maxUses) * 100);
  const isExpired = (c: AccessCode) => c.expiresAt ? new Date() > new Date(c.expiresAt) : false;

  return (
    <div className="text-white font-sans">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Event Access Codes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate codes for volunteers. Share the code — they enter it on login to auto-join the event.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(13,148,136,0.3)] flex items-center gap-2">
          + Generate Code
        </button>
      </div>

      {/* How it works */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 mb-8 flex gap-6 flex-wrap">
        {[
          { step: '1', text: 'Generate an access code for a specific event' },
          { step: '2', text: 'Share the code (e.g. HKBK-4829) with your volunteers via WhatsApp/email' },
          { step: '3', text: 'Volunteer logs in → enters code → auto-assigned to event → dashboard opens' },
        ].map(s => (
          <div key={s.step} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">{s.step}</div>
            <p className="text-slate-400 text-sm">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Code List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse bg-slate-800/50 rounded-2xl h-40" />)}
        </div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-5xl mb-4">🔑</p>
          <p className="text-lg font-semibold text-slate-400">No Access Codes Yet</p>
          <p className="text-sm mt-1 mb-6">Generate your first code and share it with volunteers.</p>
          <button onClick={() => setShowCreate(true)} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-lg text-sm transition-all">
            Generate First Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {codes.map(c => {
            const expired = isExpired(c);
            const full = c.usedCount >= c.maxUses;
            const pct = usagePercent(c);
            const statusColor = expired || full ? 'border-red-500/30 bg-red-500/5' : 'border-teal-500/20 bg-teal-500/5';

            return (
              <div key={c.id} className={`border rounded-2xl p-5 flex flex-col gap-4 ${statusColor}`}>
                {/* Code display */}
                <div className="flex items-center justify-between">
                  <div className="font-mono text-2xl font-bold tracking-widest text-white flex items-center gap-2">
                    <span className={expired || full ? 'text-slate-500 line-through' : 'text-teal-300'}>{c.code}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyCode(c.code, c.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${copiedId === c.id ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                      {copiedId === c.id ? '✓ Copied!' : '📋 Copy'}
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all">
                      🗑
                    </button>
                  </div>
                </div>

                {/* Event */}
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Event</p>
                  <p className="text-sm font-semibold text-slate-200">📍 {c.event.name}</p>
                </div>

                {/* Usage bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Usage</span>
                    <span className={full ? 'text-red-400 font-semibold' : 'text-slate-400'}>{c.usedCount} / {c.maxUses}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-teal-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>

                {/* Meta */}
                <div className="flex justify-between text-xs text-slate-500">
                  <span>By {c.creator.name}</span>
                  <span>
                    {expired ? <span className="text-red-400">⚠ Expired</span>
                      : c.expiresAt ? `Expires ${new Date(c.expiresAt).toLocaleDateString()}`
                      : 'No expiry'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Generate Access Code</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Event *</label>
                <select required value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal-500">
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Max Uses</label>
                <input type="number" min="1" max="10000" value={form.maxUses}
                  onChange={e => setForm({ ...form, maxUses: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal-500" />
                <p className="text-xs text-slate-500 mt-1">How many volunteers can use this code</p>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Expiry Date <span className="text-slate-600">(optional)</span></label>
                <input type="datetime-local" value={form.expiresAt}
                  onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal-500" />
              </div>
              <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-3 text-xs text-slate-400">
                💡 A unique code like <span className="font-mono text-teal-300">HKBK-4829</span> will be auto-generated.
                Share it with your volunteers via WhatsApp, email, or on-site.
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all">
                {saving ? 'Generating...' : '🔑 Generate Code'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
