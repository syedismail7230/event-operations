'use client';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';
const TYPE_STYLE: Record<string, string> = {
  INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  URGENT: 'bg-red-500/10 text-red-400 border-red-500/20',
  WARNING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

export default function CommunicationsModule() {
  const [history, setHistory] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ message: '', targetRole: 'ALL', type: 'INFO' });
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetchHistory();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);
    socket.on('org_notification', (msg: any) => {
      setLiveMessages(prev => [msg, ...prev]);
    });
    return () => { socket.disconnect(); };
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/dashboard/org/comms`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/dashboard/org/comms/broadcast`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setForm(f => ({ ...f, message: '' }));
      fetchHistory();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const allMessages = [...liveMessages, ...history.map(h => {
    try { return { ...JSON.parse(h.details || '{}'), id: h.id, sentAt: h.createdAt, _fromDB: true }; } catch { return null; }
  }).filter(Boolean)];

  // Deduplicate by id
  const seen = new Set<string>();
  const dedupedMessages = allMessages.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });

  return (
    <div className="text-white font-sans">
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Communications</h1>
        <p className="text-sm text-slate-400 mt-1">Broadcast real-time notifications to all org users via Socket.io.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Panel */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><span className="w-1.5 h-5 bg-sky-500 rounded-full"></span>Broadcast Message</h2>
          <form onSubmit={handleSend} className="space-y-4 text-sm">
            <div>
              <label className="block text-slate-400 mb-1">Message</label>
              <textarea required rows={4} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                placeholder="Type your message to the team..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Target Role</label>
                <select value={form.targetRole} onChange={e => setForm({...form, targetRole: e.target.value})}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500">
                  {['ALL', 'VOLUNTEER', 'MANAGER', 'USER'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Priority</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500">
                  <option value="INFO">ℹ️ Info</option>
                  <option value="WARNING">⚠️ Warning</option>
                  <option value="URGENT">🚨 Urgent</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={sending} className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
              {sending ? 'Sending...' : '📡 Broadcast Now'}
            </button>
          </form>
        </div>

        {/* Message History */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span></span>
            Live Feed
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 max-h-80">
            {loading ? (
              <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-700/50 rounded-lg"></div>)}</div>
            ) : dedupedMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No broadcasts yet. Send your first message.</div>
            ) : dedupedMessages.map((msg, i) => (
              <div key={msg.id || i} className={`p-3 rounded-xl border ${TYPE_STYLE[msg.type] || TYPE_STYLE['INFO']}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{msg.type || 'INFO'} → {msg.targetRole || 'ALL'}</span>
                  <span className="text-[10px] font-mono opacity-70">{msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString() : ''}</span>
                </div>
                <p className="text-sm">{msg.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
