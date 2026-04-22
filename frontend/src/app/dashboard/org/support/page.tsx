'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';
const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function SupportModule() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subject: '', priority: 'LOW' });
  const [sending, setSending] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API}/dashboard/org/support`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTickets(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSending(true);
    try {
      const res = await fetch(`${API}/dashboard/org/support`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) { setShowModal(false); setForm({ subject: '', priority: 'LOW' }); fetchTickets(); }
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  return (
    <div className="text-white font-sans">
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">Support Center</h1>
          <p className="text-sm text-slate-400 mt-1">Submit and track support tickets with the platform team.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all">+ New Ticket</button>
      </div>

      {/* FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: '📚', title: 'Documentation', desc: 'Setup guides, API reference, and deployment docs.', link: '#' },
          { icon: '💬', title: 'Live Chat', desc: 'Chat directly with our support engineers.', link: '#' },
          { icon: '📧', title: 'Email Support', desc: 'support@eventos.io — 24h response SLA.', link: '#' },
        ].map(c => (
          <div key={c.title} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:border-amber-500/30 transition-all">
            <p className="text-2xl mb-2">{c.icon}</p>
            <p className="font-bold text-slate-100 mb-1">{c.title}</p>
            <p className="text-xs text-slate-400">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Tickets */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-300">Your Tickets</h2>
          <span className="text-xs text-slate-500">{tickets.length} total</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-4xl mb-3">🎫</p>
            <p>No support tickets yet. You're all good!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {tickets.map(ticket => (
              <div key={ticket.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex-1">
                  <p className="font-semibold text-slate-200 text-sm">{ticket.subject}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{ticket.id?.slice(0, 8)?.toUpperCase()}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE['LOW']}`}>{ticket.priority}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${ticket.status === 'OPEN' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>{ticket.status || 'OPEN'}</span>
                <span className="text-xs text-slate-500 font-mono">{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl mx-4 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            <h2 className="text-xl font-bold mb-6 text-white">New Support Ticket</h2>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Subject / Issue</label>
                <textarea required rows={3} value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                  placeholder="Describe your issue..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <button type="submit" disabled={sending} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all">
                {sending ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
