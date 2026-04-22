'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { GoogleMap, useJsApiLoader, Marker, Polygon, InfoWindow, Circle } from '@react-google-maps/api';

const libraries: ("drawing")[] = ["drawing"];

const API = process.env.NEXT_PUBLIC_API_URL || '${process.env.NEXT_PUBLIC_API_URL}';

function polygonCentroid(coords: [number, number][]): [number, number] {
  const n = coords.length;
  return [coords.reduce((s, c) => s + c[0], 0) / n, coords.reduce((s, c) => s + c[1], 0) / n];
}

function eventCenter(ev: any): [number, number] | null {
  if (ev.geoBoundary) {
    try { const c: [number,number][] = JSON.parse(ev.geoBoundary); if (c.length >= 3) return polygonCentroid(c); } catch {}
  }
  if (ev.latitude && ev.longitude && Math.abs(ev.latitude) <= 90 && Math.abs(ev.longitude) <= 180) return [ev.latitude, ev.longitude];
  return null;
}

const roleColor: Record<string, string> = {
  VOLUNTEER: '#a855f7',
  MANAGER:   '#6366f1',
  ORG_ADMIN: '#f59e0b',
  ATTENDEE:  '#22d3ee',
};

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.75rem'
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b0f19" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f19" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1e222d" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e222d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2f3d" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1118" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

function LiveMapComponent({
  mapData,
  myPos,
  liveUsers,
}: {
  mapData: any;
  myPos: [number, number] | null;
  liveUsers: Record<string, { lat: number; lng: number; user: any; updatedAt: string }>;
}) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback((map: google.maps.Map) => {
    setMap(null);
  }, []);

  const events: any[] = mapData?.events || [];
  
  const defaultCenter = myPos ? { lat: myPos[0], lng: myPos[1] } : (() => {
    for (const ev of events) { const c = eventCenter(ev); if (c) return { lat: c[0], lng: c[1] }; }
    return { lat: 20.5937, lng: 78.9629 };
  })();

  useEffect(() => {
    if (!map) return;
    
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    if (myPos) {
      bounds.extend(new window.google.maps.LatLng(myPos[0], myPos[1]));
      hasPoints = true;
    }

    events.forEach((ev: any) => {
      if (ev.geoBoundary) {
        try {
          const coords: [number, number][] = JSON.parse(ev.geoBoundary);
          coords.forEach(c => {
            bounds.extend(new window.google.maps.LatLng(c[0], c[1]));
            hasPoints = true;
          });
        } catch {}
      } else {
        const c = eventCenter(ev);
        if (c) {
          bounds.extend(new window.google.maps.LatLng(c[0], c[1]));
          hasPoints = true;
        }
      }
    });

    if (hasPoints && events.length > 0) {
      map.fitBounds(bounds);
    }
  }, [map, events, myPos]);

  if (!isLoaded) return <div className="h-[500px] bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center text-slate-500">Loading Map...</div>;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={myPos ? 15 : 13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: true,
        }}
      >
        {/* Draw GeoFences */}
        {events.map((ev: any, i: number) => {
          if (!ev.geoBoundary) return null;
          try {
            const coords: [number, number][] = JSON.parse(ev.geoBoundary);
            const path = coords.map(c => ({ lat: c[0], lng: c[1] }));
            const centroid = polygonCentroid(coords);
            
            return (
              <div key={`ev-${i}`}>
                <Polygon
                  paths={path}
                  options={{
                    fillColor: "#14b8a6",
                    fillOpacity: 0.1,
                    strokeColor: "#14b8a6",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                  onClick={() => setActiveEvent(ev)}
                />
                <Marker
                  position={{ lat: centroid[0], lng: centroid[1] }}
                  onClick={() => setActiveEvent(ev)}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 5,
                    fillColor: "#14b8a6",
                    fillOpacity: 1,
                    strokeColor: "#14b8a6",
                    strokeWeight: 2,
                  }}
                />
              </div>
            );
          } catch {
            return null;
          }
        })}

        {/* You Are Here Marker */}
        {myPos && (
          <Marker
            position={{ lat: myPos[0], lng: myPos[1] }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#3b82f6",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }}
          >
            <InfoWindow position={{ lat: myPos[0], lng: myPos[1] }}>
              <div className="text-black font-bold">📍 You (live GPS)</div>
            </InfoWindow>
          </Marker>
        )}

        {/* Live Users */}
        {Object.values(liveUsers).map((u, i) => {
          if (!u.user?.id) return null;
          const color = roleColor[u.user.role] || '#94a3b8';
          const stale = Date.now() - new Date(u.updatedAt).getTime() > 90_000;
          
          return (
            <Marker
              key={`user-${u.user.id}`}
              position={{ lat: u.lat, lng: u.lng }}
              onClick={() => setActiveUser(u)}
              options={{
                opacity: stale ? 0.4 : 1,
              }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: color,
                fillOpacity: stale ? 0.3 : 0.85,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }}
            >
              {activeUser?.user?.id === u.user.id && (
                <InfoWindow position={{ lat: u.lat, lng: u.lng }} onCloseClick={() => setActiveUser(null)}>
                  <div className="text-black p-1">
                    <div className="font-bold">{u.user.name}</div>
                    <div className="text-xs">{u.user.role}</div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      📡 Live GPS · {Math.round((Date.now() - new Date(u.updatedAt).getTime()) / 1000)}s ago
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}

        {activeEvent && (
          <InfoWindow
            position={{ lat: polygonCentroid(JSON.parse(activeEvent.geoBoundary))[0], lng: polygonCentroid(JSON.parse(activeEvent.geoBoundary))[1] }}
            onCloseClick={() => setActiveEvent(null)}
          >
            <div className="text-black p-1">
              <div className="font-bold">📍 {activeEvent.name}</div>
              <div className="text-[11px] text-gray-500">Geo-fenced boundary</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

const MapNoSSR = dynamic(() => Promise.resolve(LiveMapComponent), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center text-slate-500">Initialising map...</div>
});

export default function LiveMapTrackingModule() {
  const [mapData,    setMapData]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [myPos,      setMyPos]      = useState<[number, number] | null>(null);
  const [accuracy,   setAccuracy]   = useState<number | null>(null);
  const [locStatus,  setLocStatus]  = useState<'waiting' | 'active' | 'denied'>('waiting');
  const [liveUsers,  setLiveUsers]  = useState<Record<string, any>>({});
  const socketRef = useRef<Socket | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const myId  = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').id : '';

  const fetchMapData = async () => {
    try {
      const res = await fetch(`${API}/dashboard/org/map`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMapData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocStatus('denied'); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(Math.round(pos.coords.accuracy));
        setLocStatus('active');
      },
      () => setLocStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    fetchMapData();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const socket = io(API, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join_org_room', user.organizationId);

    socket.emit('get_live_positions', user.organizationId);

    socket.on('live_positions_snapshot', (positions: any[]) => {
      const map: Record<string, any> = {};
      positions.forEach(p => { if (p.user?.id !== myId) map[p.user?.id] = p; });
      setLiveUsers(map);
    });

    socket.on('user_location', (data: any) => {
      if (data.userId === myId) return;
      setLiveUsers(prev => ({ ...prev, [data.userId]: data }));
    });

    socket.on('checkin_created', fetchMapData);
    return () => { socket.disconnect(); };
  }, []);

  const onlineCount  = Object.values(liveUsers).filter(u => Date.now() - new Date(u.updatedAt).getTime() < 90_000).length;
  const offlineCount = Object.values(liveUsers).length - onlineCount;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
            </span>
            Live Operations
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time GPS tracking of active personnel</p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-[#1e222d] border border-slate-700 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
            <span className="text-sm font-medium text-slate-300">{onlineCount} Online</span>
          </div>
          <div className="px-4 py-2 bg-[#1e222d] border border-slate-700 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-slate-500"></div>
            <span className="text-sm font-medium text-slate-300">{offlineCount} Inactive</span>
          </div>
        </div>
      </div>

      <div className="bg-[#1e222d] rounded-2xl p-6 border border-slate-800 shadow-xl">
        <MapNoSSR mapData={mapData} myPos={myPos} liveUsers={liveUsers} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e222d] p-5 rounded-xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Your Device Signal</p>
            <p className="text-white font-bold">{locStatus === 'active' ? `Active (${accuracy}m accuracy)` : locStatus === 'waiting' ? 'Locating...' : 'Permission Denied'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
