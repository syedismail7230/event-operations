'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';
const LOCATION_INTERVAL_MS = 15_000;

interface Violation {
  userId: string;
  user: { id: string; name: string; email: string; phone: string; role: string };
  eventId: string;
  eventName: string;
  lat: number;
  lng: number;
  timestamp: string;
  message: string;
}

interface Position { lat: number; lng: number; accuracy: number; source: 'gps' | 'manual'; }

export default function GeoFenceTracker() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [grantedExceptions, setGrantedExceptions] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [locStatus, setLocStatus] = useState<'waiting' | 'active' | 'denied' | 'error'>('waiting');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef = useRef<Position | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const isAdmin = ['ORG_ADMIN', 'ROOT_ADMIN', 'MANAGER'].includes(user.role);

  const emitLocation = useCallback((pos: Position) => {
    const socket = socketRef.current;
    if (!socket || !user.id || !user.organizationId) return;
    const payload = { lat: pos.lat, lng: pos.lng, userId: user.id, orgId: user.organizationId };
    socket.emit('location_update', payload);
  }, [user.id, user.organizationId]);

  // ─── Alert sound using Web Audio API (no file needed) ──────────
  const playAlertSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Two-tone urgent beep pattern
      const beep = (freq: number, start: number, duration: number, vol = 0.6) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration - 0.01);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      // Pattern: high-low-high-low urgent alert
      beep(1200, 0.0, 0.12);
      beep(800,  0.15, 0.12);
      beep(1200, 0.30, 0.12);
      beep(800,  0.45, 0.12);
      beep(1400, 0.65, 0.25);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user.id) return;

    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);

    socket.on('geo_violation', (v: Violation) => {
      setViolations(prev => {
        const filtered = prev.filter(x => !(x.userId === v.userId && x.eventId === v.eventId));
        return [v, ...filtered];
      });
      setShowPanel(true);
      playAlertSound();  // 🔔 alert sound on violation
    });

    socket.on('geo_exception_granted', ({ userId, eventId }: any) => {
      setViolations(prev => prev.filter(v => !(v.userId === userId && v.eventId === eventId)));
    });

    // ─── Geolocation with highest accuracy settings ─────────────
    if ('geolocation' in navigator) {
      const GEO_OPTIONS: PositionOptions = {
        enableHighAccuracy: true, // forces GPS on mobile, WiFi on desktop
        maximumAge: 0,            // never return cached position
        timeout: 30000            // wait up to 30s for accurate fix
      };

      const onSuccess = (rawPos: GeolocationPosition) => {
        const pos: Position = {
          lat: rawPos.coords.latitude,
          lng: rawPos.coords.longitude,
          accuracy: rawPos.coords.accuracy, // metres
          source: 'gps'
        };
        setPosition(pos);
        posRef.current = pos;
        setLocStatus('active');
      };

      const onError = (err: GeolocationPositionError) => {
        if (err.code === err.PERMISSION_DENIED) setLocStatus('denied');
        else setLocStatus('error');
      };

      // Get immediate fix, then watch
      navigator.geolocation.getCurrentPosition(onSuccess, onError, GEO_OPTIONS);
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, GEO_OPTIONS);

      // Emit every 15s
      intervalRef.current = setInterval(() => {
        if (posRef.current) emitLocation(posRef.current);
      }, LOCATION_INTERVAL_MS);
    }

    return () => {
      socket.disconnect();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user.id]);

  // ─── Manual coordinate override (for desktop / testing) ───────
  const applyManual = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) return;
    const pos: Position = { lat, lng, accuracy: 0, source: 'manual' };
    setPosition(pos);
    posRef.current = pos;
    setLocStatus('active');
    emitLocation(pos);
  };

  const toggleException = async (v: Violation) => {
    const key = `${v.userId}_${v.eventId}`;
    const isGranted = grantedExceptions.has(key);
    setTogglingId(key);
    try {
      if (isGranted) {
        // Revoke — remove exception so geo fence applies again
        await fetch(`${API}/dashboard/org/geo-exceptions/${v.eventId}/${v.userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setGrantedExceptions(prev => { const s = new Set(prev); s.delete(key); return s; });
      } else {
        // Grant — allow user outside geo fence
        await fetch(`${API}/dashboard/org/geo-exceptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: v.userId, eventId: v.eventId, reason: 'Approved via violation panel' })
        });
        setGrantedExceptions(prev => new Set([...prev, key]));
        setViolations(prev => prev.filter(x => !(x.userId === v.userId && x.eventId === v.eventId)));
        if (socketRef.current) {
          socketRef.current.emit('geo_exception_granted', { userId: v.userId, eventId: v.eventId });
        }
      }
    } finally {
      setTogglingId(null);
    }
  };

  // legacy alias
  const grantException = (v: Violation) => toggleException(v);

  // ─── Status pill ──────────────────────────────────────────────
  const statusPill = () => {
    if (locStatus === 'active' && position) {
      const accuracyLabel = position.source === 'manual' ? 'Manual' : position.accuracy > 100 ? `±${Math.round(position.accuracy)}m ⚠️` : `±${Math.round(position.accuracy)}m ✓`;
      return (
        <button onClick={() => setShowDebug(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border backdrop-blur-sm shadow-lg ${position.accuracy > 100 && position.source !== 'manual' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-slate-900/90 border-green-500/30 text-green-400'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
          GPS {accuracyLabel}
        </button>
      );
    }
    if (locStatus === 'denied') return <button onClick={() => setShowDebug(p => !p)} className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-xs backdrop-blur-sm">📍 Location denied — click to set manually</button>;
    if (locStatus === 'error') return <button onClick={() => setShowDebug(p => !p)} className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-full text-xs backdrop-blur-sm">⚠️ Location error — click to set manually</button>;
    return <div className="bg-slate-900/90 border border-slate-700 text-slate-400 px-3 py-1.5 rounded-full text-xs animate-pulse">Acquiring GPS...</div>;
  };

  return (
    <>
      {/* Fixed bottom-right controls */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {violations.length > 0 && (
          <button onClick={() => setShowPanel(p => !p)}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-2 animate-pulse">
            🚨 {violations.length} Geo Violation{violations.length > 1 ? 's' : ''}
          </button>
        )}
        {statusPill()}
      </div>

      {/* ─── Debug / Manual Override Panel ─── */}
      {showDebug && (
        <div className="fixed bottom-16 right-4 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-slate-200 text-xs uppercase tracking-wider">📍 Location Debug</p>
            <button onClick={() => setShowDebug(false)} className="text-slate-500 hover:text-white">✕</button>
          </div>

          {position && (
            <div className="bg-slate-800/50 rounded-xl p-3 mb-3 text-xs font-mono space-y-1">
              <p className="text-slate-400">Current position:</p>
              <p className="text-green-400">Lat: {position.lat.toFixed(6)}</p>
              <p className="text-green-400">Lng: {position.lng.toFixed(6)}</p>
              <p className={position.source === 'manual' ? 'text-blue-400' : position.accuracy > 100 ? 'text-yellow-400' : 'text-green-400'}>
                Accuracy: {position.source === 'manual' ? 'Manual override' : `±${Math.round(position.accuracy)} metres`}
              </p>
              {position.accuracy > 100 && position.source !== 'manual' && (
                <p className="text-yellow-400 text-[10px] leading-tight mt-1">
                  ⚠️ Low accuracy — browser is using WiFi/IP instead of GPS. Use manual override below for accurate tracking.
                </p>
              )}
              <a href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=15/${position.lat}/${position.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-block mt-1 text-blue-400 hover:underline text-[10px]">
                Verify on OpenStreetMap ↗
              </a>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-semibold">Manual Override</p>
            <p className="text-[10px] text-slate-500">Use this on desktop or when GPS is inaccurate. You can copy coordinates from Google Maps (right-click → What's here?).</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Latitude</label>
                <input type="number" step="any" value={manualLat} onChange={e => setManualLat(e.target.value)}
                  placeholder="24.8607"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Longitude</label>
                <input type="number" step="any" value={manualLng} onChange={e => setManualLng(e.target.value)}
                  placeholder="67.0011"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono" />
              </div>
            </div>
            <button onClick={applyManual}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 rounded-lg transition-all">
              Apply & Send to Server
            </button>
          </div>
        </div>
      )}

      {/* ─── Geo Violation Panel — always on top with full backdrop ─── */}
      {showPanel && violations.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-end p-4 pt-20 pointer-events-none">
          {/* Backdrop — only half-dim so map is still visible */}
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowPanel(false)} />

          <div className="relative pointer-events-auto w-[min(96vw,420px)] max-h-[80vh] overflow-y-auto bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl shadow-red-500/20 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-red-500/20 px-4 py-3 flex items-center justify-between z-10 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-bold text-red-400">Geo-Fence Violations</span>
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{violations.length}</span>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            {/* Violation cards */}
            <div className="p-3 space-y-3 overflow-y-auto">
              {violations.map(v => {
                const key = `${v.userId}_${v.eventId}`;
                const isGranted = grantedExceptions.has(key);
                const isToggling = togglingId === key;
                return (
                  <div key={key} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-red-600/30 border-2 border-red-500/50 flex items-center justify-center font-bold text-red-300 shrink-0 text-lg">
                        {v.user?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-red-300 text-sm">{v.user?.name}</p>
                        <p className="text-xs text-slate-400">{v.user?.role} · {v.user?.email}</p>
                        {v.user?.phone && <p className="text-xs text-slate-500">📞 {v.user.phone}</p>}
                      </div>
                      <span className="text-[10px] text-red-400 font-mono shrink-0">{new Date(v.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div className="bg-slate-800/60 rounded-lg p-2.5 mb-3 space-y-1">
                      <p className="text-xs text-slate-300">
                        ⚠️ Exited geo-fence: <span className="font-semibold text-amber-400">{v.eventName}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {v.lat.toFixed(6)}, {v.lng.toFixed(6)} ·{' '}
                        <a href={`https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=16/${v.lat}/${v.lng}`}
                          target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View on map ↗</a>
                      </p>
                    </div>

                    {/* Geo-fence toggle — visible and actionable to all roles including volunteers */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleException(v)}
                        disabled={isToggling}
                        className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                          isGranted
                            ? 'bg-red-600 hover:bg-red-500 text-white border border-red-500/50'
                            : 'bg-green-600 hover:bg-green-500 text-white border border-green-500/50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isToggling ? (
                          <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Working...</>
                        ) : isGranted ? (
                          <>🔒 Revoke — Re-enforce Geo Fence</>
                        ) : (
                          <>🔓 Allow Outside Geo Fence</>
                        )}
                      </button>
                      <button
                        onClick={() => setViolations(prev => prev.filter(x => !(x.userId === v.userId && x.eventId === v.eventId)))}
                        className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition-colors shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
