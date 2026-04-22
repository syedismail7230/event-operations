'use client';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

interface Channel { id: string; name: string; event?: { id: string; name: string }; members?: Member[]; createdAt: string; }
interface Member { id: string; user: { id: string; name: string; role: string }; }

// Detect supported MIME type at module level (browser only)
const getSupportedMime = () => {
  if (typeof window === 'undefined') return 'audio/webm;codecs=opus';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } })
    ?? '';
};

export default function WalkieTalkiePTT() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState<Channel | null>(null);
  const [form, setForm] = useState({ eventId: '', name: '', memberIds: [] as string[] });
  const [transmitting, setTransmitting] = useState<string | null>(null);
  const [speakingIn, setSpeakingIn] = useState<Record<string, { name: string }>>({});
  const [micStatus, setMicStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [addMemberId, setAddMemberId] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('');

  // MediaSource streaming (correct way to play streaming WebM chunks)
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const pendingChunksRef = useRef<ArrayBuffer[]>([]);
  const appendingRef = useRef(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  // ─── Append next pending chunk to SourceBuffer (sequential, non-overlapping) ───
  const flushChunks = () => {
    const sb = sourceBufferRef.current;
    if (!sb || appendingRef.current || pendingChunksRef.current.length === 0) return;
    appendingRef.current = true;
    const chunk = pendingChunksRef.current.shift()!;
    try {
      sb.appendBuffer(chunk);
    } catch (e) {
      console.warn('[PTT] appendBuffer error:', e);
      appendingRef.current = false;
    }
  };

  // ─── Setup a fresh MediaSource+SourceBuffer for playback ───
  const setupMediaSource = (mimeType: string) => {
    if (!window.MediaSource || !MediaSource.isTypeSupported(mimeType)) {
      console.warn('[PTT] MediaSource not supported for', mimeType);
      return;
    }
    // Clean up any previous session
    if (audioElRef.current) {
      audioElRef.current.src = '';
    }
    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    sourceBufferRef.current = null;
    pendingChunksRef.current = [];
    appendingRef.current = false;

    ms.addEventListener('sourceopen', () => {
      try {
        const sb = ms.addSourceBuffer(mimeType);
        sourceBufferRef.current = sb;
        sb.addEventListener('updateend', () => {
          appendingRef.current = false;
          flushChunks();
        });
        // Flush any chunks that arrived before sourceopen
        flushChunks();
      } catch (e) {
        console.warn('[PTT] addSourceBuffer error:', e);
      }
    });

    if (audioElRef.current) {
      audioElRef.current.src = URL.createObjectURL(ms);
      audioElRef.current.play().catch(() => {});
    }
  };

  // ─── Receive a chunk and push into SourceBuffer ───
  const receiveChunk = (raw: any) => {
    // Normalise to ArrayBuffer
    let ab: ArrayBuffer;
    if (raw instanceof ArrayBuffer) {
      ab = raw;
    } else if (raw?.buffer instanceof ArrayBuffer) {
      ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
    } else {
      try { ab = new Uint8Array(Object.values(raw as Record<string, number>)).buffer; }
      catch { return; }
    }
    if (ab.byteLength === 0) return;

    pendingChunksRef.current.push(ab);
    flushChunks();
  };

  // ─── Init socket ───
  useEffect(() => {
    fetchAll();
    mimeTypeRef.current = getSupportedMime();

    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', currentUser.organizationId);

    socket.on('channel_created', (ch: Channel) => setChannels(prev => [ch, ...prev]));
    socket.on('channel_deleted', ({ channelId }: any) => setChannels(prev => prev.filter(c => c.id !== channelId)));

    socket.on('ptt_speaking', ({ channelId, userName }: any) => {
      setSpeakingIn(prev => ({ ...prev, [channelId]: { name: userName } }));
      // Someone just started talking — setup fresh MediaSource for this session
      setupMediaSource(mimeTypeRef.current);
    });

    socket.on('ptt_released', ({ channelId }: any) => {
      setSpeakingIn(prev => { const n = { ...prev }; delete n[channelId]; return n; });
      // End the MediaSource stream gracefully
      try {
        const ms = mediaSourceRef.current;
        const sb = sourceBufferRef.current;
        if (ms && ms.readyState === 'open') {
          if (sb && !sb.updating) ms.endOfStream();
          else if (sb) sb.addEventListener('updateend', () => { try { ms.endOfStream(); } catch {} }, { once: true });
        }
      } catch {}
    });

    socket.on('ptt_audio_chunk', ({ chunk }: { channelId: string; chunk: any }) => {
      receiveChunk(chunk);
    });

    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-join all channel rooms once loaded (passive listening) ───
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || channels.length === 0) return;
    channels.forEach(ch => socket.emit('join_ptt_channel', ch.id));
  }, [channels]);

  const fetchAll = async () => {
    try {
      const [chRes, evRes, usersRes] = await Promise.all([
        fetch(`${API}/dashboard/org/channels`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/dashboard/org/users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (chRes.ok) {
        const chData = await chRes.json();
        const channelsWithMembers = await Promise.all(chData.map(async (ch: Channel) => {
          const mr = await fetch(`${API}/dashboard/org/channels/${ch.id}/members`, { headers: { Authorization: `Bearer ${token}` } });
          const members = mr.ok ? await mr.json() : [];
          return { ...ch, members };
        }));
        setChannels(channelsWithMembers);
      }
      if (evRes.ok) setEvents(await evRes.json());
      if (usersRes.ok) {
        const all = await usersRes.json();
        setUsers(all.filter((u: any) => ['VOLUNTEER', 'MANAGER', 'ORG_ADMIN', 'ROOT_ADMIN'].includes(u.role)));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const startTransmit = async (channelId: string) => {
    if (transmitting) return;
    let stream = localStreamRef.current;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setMicStatus('granted');
      } catch {
        setMicStatus('denied');
        return;
      }
    }

    setTransmitting(channelId);
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('join_ptt_channel', channelId);
    socket.emit('ptt_acquire', { channelId, userId: currentUser.id, userName: currentUser.name });

    const mime = mimeTypeRef.current;
    const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0 && socket.connected) {
        const ab = await e.data.arrayBuffer();
        socket.emit('ptt_audio_chunk', { channelId, chunk: ab, userId: currentUser.id });
      }
    };
    recorder.start(100); // 100ms chunks
  };

  const stopTransmit = (channelId: string) => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) socket.emit('ptt_release', { channelId, userId: currentUser.id });
    setTransmitting(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/dashboard/org/channels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) { setShowCreateModal(false); setForm({ eventId: '', name: '', memberIds: [] }); fetchAll(); }
  };

  const handleAddMember = async (channelId: string) => {
    if (!addMemberId) return;
    await fetch(`${API}/dashboard/org/channels/${channelId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: addMemberId })
    });
    setAddMemberId(''); fetchAll();
  };

  const handleRemoveMember = async (channelId: string, userId: string) => {
    await fetch(`${API}/dashboard/org/channels/${channelId}/members/${userId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    fetchAll();
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Delete this PTT group? This cannot be undone.')) return;
    const res = await fetch(`${API}/dashboard/org/channels/${channelId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setChannels(prev => prev.filter(c => c.id !== channelId));
  };

  const toggleMember = (userId: string) => {
    setForm(f => ({
      ...f,
      memberIds: f.memberIds.includes(userId) ? f.memberIds.filter(id => id !== userId) : [...f.memberIds, userId]
    }));
  };

  return (
    <div className="text-white font-sans">
      {/* Hidden audio element for MediaSource playback */}
      <audio ref={audioElRef} style={{ display: 'none' }} autoPlay playsInline />

      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Walkie-Talkie (PTT)</h1>
          <p className="text-sm text-slate-400 mt-1">Hold to talk. Audio streams instantly to all group members.</p>
        </div>
        <div className="flex items-center gap-3">
          {micStatus === 'denied' && (
            <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">🎙️ Mic blocked — allow in browser</span>
          )}
          {micStatus === 'granted' && (
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg">✓ Mic active</span>
          )}
          <button onClick={() => setShowCreateModal(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)]">+ New Group</button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse bg-slate-800/50 rounded-2xl h-56"></div>)}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-5xl mb-4">📻</p>
          <p className="text-lg font-semibold text-slate-400">No PTT Groups Created</p>
          <p className="text-sm mt-2">Create a group, add members, and hold to talk.</p>
          <button onClick={() => setShowCreateModal(true)} className="mt-6 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-6 rounded-lg text-sm transition-all">Create First Group</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map(ch => {
            const isTx = transmitting === ch.id;
            const rxInfo = speakingIn[ch.id];
            const hasRx = !!rxInfo && !isTx;

            return (
              <div key={ch.id} className={`border rounded-2xl p-6 transition-all flex flex-col ${isTx ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_30px_rgba(217,119,6,0.2)]' : hasRx ? 'bg-green-500/10 border-green-500/40' : 'bg-slate-800/40 border-slate-700/50 hover:border-amber-500/20'}`}>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isTx ? 'bg-amber-500/30 scale-110' : 'bg-amber-600/20'}`}>📻</div>
                    <div>
                      <p className="font-bold text-slate-100 text-sm">{ch.name}</p>
                      <p className="text-xs text-slate-500">{ch.event?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowMembersModal(ch)} className="text-xs text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/30 px-2 py-1 rounded-lg transition-colors">
                      👥 {ch.members?.length || 0}
                    </button>
                    <button onClick={() => handleDeleteChannel(ch.id)} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors">🗑️</button>
                  </div>
                </div>

                <div className="flex gap-1 flex-wrap mb-3 min-h-[24px]">
                  {(ch.members || []).slice(0, 5).map(m => (
                    <span key={m.id} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{m.user.name}</span>
                  ))}
                  {(ch.members?.length || 0) > 5 && <span className="text-[10px] text-slate-500">+{(ch.members?.length || 0) - 5} more</span>}
                </div>

                {/* Voice bars */}
                <div className={`flex items-end gap-0.5 h-8 mb-4 ${isTx || hasRx ? 'opacity-100' : 'opacity-20'}`}>
                  {[...Array(28)].map((_, j) => (
                    <div key={j} className={`flex-1 rounded-sm ${isTx ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ height: `${(isTx || hasRx) ? 20 + Math.abs(Math.sin(j * 0.7)) * 60 : 10 + (j % 5) * 8}%` }} />
                  ))}
                </div>

                {isTx && <p className="text-xs text-amber-400 text-center mb-2 font-bold animate-pulse">🔴 TRANSMITTING...</p>}
                {hasRx && <p className="text-xs text-green-400 text-center mb-2 font-semibold animate-pulse">🔊 {rxInfo.name} is talking...</p>}

                <button
                  onMouseDown={() => startTransmit(ch.id)}
                  onMouseUp={() => isTx && stopTransmit(ch.id)}
                  onMouseLeave={() => isTx && stopTransmit(ch.id)}
                  onTouchStart={(e) => { e.preventDefault(); startTransmit(ch.id); }}
                  onTouchEnd={(e) => { e.preventDefault(); isTx && stopTransmit(ch.id); }}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 select-none mt-auto ${
                    isTx ? 'bg-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.6)] text-white scale-105' : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {isTx ? '🔴 Release to Stop' : '🎙️ Hold to Talk'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 bg-slate-800/40 border border-amber-500/10 rounded-2xl p-4">
        <p className="text-xs text-amber-400 font-bold uppercase mb-1">⚡ Server-Relayed Audio via MediaSource</p>
        <p className="text-xs text-slate-400">WebM chunks stream through the server and are appended sequentially to a MediaSource SourceBuffer for gapless playback.</p>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl my-4 relative">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            <h2 className="text-xl font-bold mb-6 text-white">Create PTT Group</h2>
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Event</label>
                <select required value={form.eventId} onChange={e => setForm({...form, eventId: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500">
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Group Name</label>
                <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="e.g. Security Team Alpha"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-slate-400 mb-2">Add Members ({form.memberIds.length} selected)</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {users.filter(u => u.status === 'ACTIVE').map(u => (
                    <button key={u.id} type="button" onClick={() => toggleMember(u.id)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${form.memberIds.includes(u.id) ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-[10px] opacity-70">{u.role}</p>
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-all">Create Group</button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setShowMembersModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            <h2 className="text-xl font-bold mb-2 text-white">{showMembersModal.name}</h2>
            <p className="text-xs text-slate-500 mb-5">Manage group members</p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {(showMembersModal.members || []).length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No members yet.</p>
              ) : (showMembersModal.members || []).map(m => (
                <div key={m.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{m.user.name}</p>
                    <p className="text-xs text-slate-500">{m.user.role}</p>
                  </div>
                  <button onClick={() => handleRemoveMember(showMembersModal.id, m.user.id)} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded transition-colors">Remove</button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 mb-2 font-semibold">Add Member</p>
              <div className="flex gap-2">
                <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                  <option value="">Select user...</option>
                  {users.filter(u => !showMembersModal.members?.find(m => m.user.id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <button onClick={() => handleAddMember(showMembersModal.id)} className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
