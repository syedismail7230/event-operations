'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLat?: number;
  lastLng?: number;
  lastSeen?: string;
  isOnline?: boolean;
  isInsideGeo?: boolean;
  lastCheckIn?: { direction: string; timestamp: string; event: { name: string } };
}

export default function VolunteerDashboard() {
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [livePositions, setLivePositions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [micStatus, setMicStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [locStatus, setLocStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendees' | 'qr'>('attendees');
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  // ─── Role guard ─────────────────────
  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    if (user.role === 'ORG_ADMIN' || user.role === 'ROOT_ADMIN') { router.replace('/dashboard/org'); return; }
    if (user.role === 'MANAGER') { router.replace('/dashboard/manager'); return; }

    checkPermissions();
    fetchAttendees();
    setupSocket();

    return () => { socketRef.current?.disconnect(); };
  }, []);

  const checkPermissions = () => {
    // Check mic
    navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
      .then(() => setMicStatus('granted'))
      .catch(() => setMicStatus('denied'));

    // Check location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setLocStatus('granted'),
        () => setLocStatus('denied'),
        { enableHighAccuracy: true }
      );
    } else {
      setLocStatus('denied');
    }
  };

  const grantPermissionsAndSound = () => {
    try {
      // 🔊 Max volume + init audio context (fixes autoplay issues)
      (document as any).querySelectorAll('audio, video').forEach((el: any) => { el.volume = 1; });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctx.resume().then(() => setSoundEnabled(true));
    } catch {}
    checkPermissions();
  };

  const setupSocket = () => {
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);
    socket.emit('get_live_positions', user.organizationId);

    socket.on('live_positions_snapshot', (positions: any[]) => {
      const map: Record<string, any> = {};
      positions.forEach(p => { if (p.user?.id) map[p.user.id] = p; });
      setLivePositions(map);
    });

    socket.on('user_location', (data: any) => {
      setLivePositions(prev => ({ ...prev, [data.userId]: data }));
    });
  };

  const fetchAttendees = async () => {
    try {
      const res = await fetch(`${API}/dashboard/org/users`, { headers: { Authorization: `Bearer ${token}` } });
      const checkinsRes = await fetch(`${API}/dashboard/org/checkins`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const users = await res.json();
        const checkins = checkinsRes.ok ? await checkinsRes.json() : [];

        // Map latest check-in per user
        const latestCI: Record<string, any> = {};
        (checkins as any[]).forEach((ci: any) => {
          if (!latestCI[ci.userId] || new Date(ci.timestamp) > new Date(latestCI[ci.userId].timestamp)) {
            latestCI[ci.userId] = ci;
          }
        });

        setAttendees(users.map((u: any) => ({
          ...u,
          lastCheckIn: latestCI[u.id] || null,
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ─── QR scanner using jsQR ────────────────────────────────────
  const startQRScan = async () => {
    setShowQR(true);
    setQrResult(null);
    setScanStatus(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanFrame();
      }
    } catch {
      setScanStatus({ type: 'error', msg: 'Camera access denied. Please allow camera access.' });
    }
  };

  const stopQRScan = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setScanning(false);
    setShowQR(false);
  };

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !scanning) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Dynamically import jsQR
    import('jsqr').then(({ default: jsQR }) => {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        handleQRCode(code.data);
      } else {
        requestAnimationFrame(scanFrame);
      }
    });
  }, [scanning]);

  const handleQRCode = async (data: string) => {
    setScanning(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setQrResult(data);

    // data should be a userId or attendeeId from their QR code
    try {
      const res = await fetch(`${API}/dashboard/org/checkins/qr-scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedUserId: data, scannedByVolunteerId: user.id })
      });
      const result = await res.json();
      if (res.ok) {
        setScanStatus({ type: 'success', msg: `✅ ${result.message} — ${result.attendeeName}` });
        fetchAttendees();
      } else {
        setScanStatus({ type: 'error', msg: `❌ ${result.error}` });
      }
    } catch {
      setScanStatus({ type: 'error', msg: '❌ Server error. Try again.' });
    }
  };

  const getAttendeeStatus = (a: Attendee) => {
    const livePos = livePositions[a.id];
    const isOnline = livePos && (Date.now() - new Date(livePos.updatedAt).getTime() < 120_000);
    const checkedIn = a.lastCheckIn?.direction === 'IN';
    return { isOnline, checkedIn, livePos };
  };

  // ─── Mandatory Permissions Gate ───
  if (micStatus !== 'granted' || locStatus !== 'granted' || !soundEnabled) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <span className="text-4xl">🛑</span>
          </div>
          <h1 className="text-2xl font-bold mb-3 text-slate-100">Permissions Required</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            To access the field dashboard, it is <strong className="text-white">mandatory</strong> to enable your location, microphone, and audio. This ensures your safety, live tracking, and walkie-talkie access.
          </p>

          <div className="space-y-4 text-left mb-8">
            <div className={`p-4 rounded-xl border flex items-center gap-4 ${locStatus === 'granted' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
              <span className="text-2xl">{locStatus === 'granted' ? '📍' : '❓'}</span>
              <div>
                <p className="font-semibold text-sm">Live Location</p>
                <p className="text-xs opacity-70">For geo-fence tracking</p>
              </div>
            </div>
            
            <div className={`p-4 rounded-xl border flex items-center gap-4 ${micStatus === 'granted' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
              <span className="text-2xl">{micStatus === 'granted' ? '🎙️' : '❓'}</span>
              <div>
                <p className="font-semibold text-sm">Microphone</p>
                <p className="text-xs opacity-70">For live walkie-talkie</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex items-center gap-4 ${soundEnabled ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
              <span className="text-2xl">{soundEnabled ? '🔊' : '❓'}</span>
              <div>
                <p className="font-semibold text-sm">Audio Access</p>
                <p className="text-xs opacity-70">For emergency alerts</p>
              </div>
            </div>
          </div>

          <button onClick={grantPermissionsAndSound}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(13,148,136,0.3)] animate-pulse">
            Grant Required Permissions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white font-sans p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Welcome, {user.name?.split(' ')[0]}! 👋</h1>
        <p className="text-slate-400 text-sm mt-1">Volunteer Command Center</p>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border font-semibold ${
          micStatus === 'granted' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          micStatus === 'denied' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          🎙️ {micStatus === 'granted' ? 'Mic Ready (Walkie-Talkie Active)' : micStatus === 'denied' ? 'Mic Blocked' : 'Requesting Mic...'}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border bg-green-500/10 border-green-500/30 text-green-400 font-semibold">
          🔊 Volume Maxed
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Walkie-Talkie', icon: '📻', href: '/dashboard/org/ptt', color: 'from-amber-600 to-orange-600' },
          { label: 'User Tracking', icon: '🗺️', href: '/dashboard/org/map', color: 'from-blue-600 to-cyan-600' },
          { label: 'Master Roster', icon: '📋', href: '/dashboard/volunteer/attendees', color: 'from-purple-600 to-fuchsia-600' },
          { label: 'Report Issue', icon: '🚨', href: '/dashboard/org/incidents', color: 'from-red-600 to-rose-600' },
        ].map(a => (
          <a key={a.label} href={a.href}
            className="bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all hover:bg-slate-800 group">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-xl shadow-lg`}>{a.icon}</div>
            <p className="text-xs font-semibold text-slate-300 group-hover:text-white text-center">{a.label}</p>
          </a>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-xl p-1 mb-5 gap-1">
        {[
          { key: 'attendees', label: '👥 Attendees' },
          { key: 'qr', label: '📷 QR Check-In/Out' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Attendee Tracking Tab ─── */}
      {activeTab === 'attendees' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-300">All Attendees <span className="text-slate-500">({attendees.length})</span></p>
            <button onClick={fetchAttendees} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">↻ Refresh</button>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-slate-800/50 h-16 rounded-xl" />)}</div>
          ) : attendees.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No attendees found for your organization.</div>
          ) : (
            <div className="space-y-2">
              {attendees.map(a => {
                const { isOnline, checkedIn, livePos } = getAttendeeStatus(a);
                const isInsideGeo = livePos?.isInsideGeo;
                const lastSeen = livePos ? Math.round((Date.now() - new Date(livePos.updatedAt).getTime()) / 1000) : null;

                return (
                  <div key={a.id} className={`border rounded-xl p-3 flex items-center gap-3 transition-all ${
                    checkedIn ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-800/40 border-slate-700/50'
                  }`}>
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      isOnline ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/40' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {a.name?.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200 truncate">{a.name}</p>
                        {isOnline && (
                          <span className="flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{a.email}</p>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Check-in status */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        checkedIn ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'
                      }`}>
                        {checkedIn ? '✓ IN' : '○ OUT'}
                      </span>

                      {/* Geo status */}
                      {isOnline && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isInsideGeo === false ? 'bg-red-500/20 text-red-400' :
                          isInsideGeo === true ? 'bg-teal-500/20 text-teal-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {isInsideGeo === false ? '⚠ Outside' : isInsideGeo === true ? '📍 Inside' : '📡 Live'}
                        </span>
                      )}

                      {/* Last seen */}
                      {lastSeen !== null && (
                        <span className="text-[9px] text-slate-600">{lastSeen < 60 ? `${lastSeen}s ago` : `${Math.round(lastSeen/60)}m ago`}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── QR Check-In/Out Tab ─── */}
      {activeTab === 'qr' && (
        <div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 text-center mb-5">
            <p className="text-3xl mb-3">📷</p>
            <p className="font-semibold text-slate-200 mb-1">QR-Based Check-In / Check-Out</p>
            <p className="text-xs text-slate-400 mb-4">
              Scan an attendee's QR code to toggle their check-in status.<br/>
              First scan = <span className="text-green-400 font-semibold">Check-In</span> · Second scan = <span className="text-red-400 font-semibold">Check-Out</span>
            </p>
            <button onClick={startQRScan}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-8 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(13,148,136,0.3)]">
              📷 Start Scanning
            </button>
          </div>

          {/* Result */}
          {scanStatus && (
            <div className={`border rounded-xl p-4 text-center text-sm font-semibold ${
              scanStatus.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {scanStatus.msg}
              <button onClick={() => { setScanStatus(null); setQrResult(null); }} className="block mx-auto mt-2 text-xs text-slate-400 hover:text-white">Scan Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ─── QR Camera Modal ─── */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-4">
          <p className="text-lg font-bold text-white mb-4">📷 Point at Attendee QR Code</p>
          <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden border-2 border-teal-500/40">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-teal-400 rounded-xl relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-teal-400/60 animate-pulse" />
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-4 animate-pulse">Scanning...</p>
          <button onClick={stopQRScan} className="mt-6 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-6 py-2 rounded-xl text-sm transition-colors">Cancel</button>
        </div>
      )}
    </div>
  );
}
