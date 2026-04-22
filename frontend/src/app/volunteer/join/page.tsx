'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

export default function VolunteerJoinPage() {
  const router = useRouter();
  const [segments, setSegments] = useState(['', '', '', '', '']); // 4 chars + dash + 4 digits = displayed as 4+4
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!token) { router.replace('/login'); return; }
    // Admins / managers should never land here
    if (user.role === 'ORG_ADMIN' || user.role === 'ROOT_ADMIN') {
      router.replace('/dashboard/org'); return;
    }
    if (user.role === 'MANAGER') {
      router.replace('/dashboard/manager'); return;
    }
    // Volunteer already fully assigned → skip code entry
    if (user.role === 'VOLUNTEER' && user.organizationId && user.status === 'ACTIVE') {
      router.replace('/dashboard/volunteer'); return;
    }
    inputRef.current?.focus();
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only alphanumeric, strip non-alphanum, uppercase, max 8 chars
    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    setCode(raw);
    setError('');
  };

  const displayCode = code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 8) { setError('Enter the full 8-character code (e.g. HKBK-4829)'); return; }
    setLoading(true); setError('');

    try {
      const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
      const res = await fetch(`${API}/dashboard/org/redeem-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formatted })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid code.'); return; }

      // Update localStorage user with new orgId + role
      const updatedUser = { ...user, organizationId: data.event.organizationId, role: 'VOLUNTEER', status: 'ACTIVE' };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setSuccess(data);
      setTimeout(() => router.replace('/dashboard/volunteer'), 2200);
    } catch {
      setError('Connection error. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050d1a] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">You're in!</h1>
          <p className="text-slate-400 text-lg mb-1">
            Assigned to <span className="text-teal-400 font-semibold">{success.event.name}</span>
          </p>
          <p className="text-slate-500 text-sm">Opening your dashboard...</p>
          <div className="mt-6 flex justify-center gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050d1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600/20 border border-teal-500/30 mb-4">
            <span className="text-3xl">🎟️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Event Access Code</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Welcome, <span className="text-slate-300 font-semibold">{mounted ? (user.name || 'Volunteer') : 'Volunteer'}</span>!<br />
            Enter the access code given by your event admin to join.
          </p>
        </div>

        {/* Code Entry Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 text-center">
                Access Code
              </label>

              {/* Visual display of code segments */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {/* 4 char block */}
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                      code[i] ? 'border-teal-500 bg-teal-500/10 text-teal-300' : 'border-slate-700 bg-slate-800/50 text-slate-600'
                    }`}>
                      {code[i] || '·'}
                    </div>
                  ))}
                </div>
                <div className="text-slate-500 font-bold text-xl">—</div>
                {/* 4 digit block */}
                <div className="flex gap-1">
                  {[4, 5, 6, 7].map(i => (
                    <div key={i} className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                      code[i] ? 'border-teal-500 bg-teal-500/10 text-teal-300' : 'border-slate-700 bg-slate-800/50 text-slate-600'
                    }`}>
                      {code[i] || '·'}
                    </div>
                  ))}
                </div>
              </div>

              {/* Hidden actual input */}
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={handleInput}
                placeholder="Type your code here..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-white font-mono text-lg tracking-[0.3em] focus:outline-none focus:border-teal-500 transition-colors uppercase placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-slate-600 text-center mt-2">Format: XXXX-0000 (ask your event manager)</p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || code.length < 8}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(13,148,136,0.3)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                '🎟️ Join Event'
              )}
            </button>

            {/* Skip / already assigned */}
            <div className="text-center">
              <button type="button" onClick={() => router.replace('/dashboard/volunteer')}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
                Already assigned to an event? Skip →
              </button>
            </div>
          </form>
        </div>

        {/* Sign out link */}
        <div className="text-center mt-6">
          <button onClick={() => { localStorage.clear(); router.replace('/login'); }}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
