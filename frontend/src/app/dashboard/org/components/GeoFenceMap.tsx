'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon } from '@react-google-maps/api';

const libraries: ("drawing")[] = ["drawing"];

const mapContainerStyle = {
  width: '100%',
  height: '360px',
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

interface Props {
  onBoundaryChange: (coords: [number, number][]) => void;
  initialCoords?: [number, number][];
  center?: [number, number];
  onLocationPick?: (lat: number, lng: number, label: string) => void;
}

export default function GeoFenceMapDraw({ onBoundaryChange, initialCoords, center, onLocationPick }: Props) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.error('Search error', e);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocation(val), 400);
  };

  const flyToResult = (result: any) => {
    if (!map) return;
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    map.panTo({ lat, lng: lon });
    map.setZoom(15);
    setSearchResults([]);
    const label = result.display_name.split(',')[0];
    setSearchQuery(label);
    if (onLocationPick) onLocationPick(lat, lon, label);
  };

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback((mapInstance: google.maps.Map) => {
    setMap(null);
  }, []);

  const defaultCenter = center ? { lat: center[0], lng: center[1] } : { lat: 24.8607, lng: 67.0011 };

  useEffect(() => {
    if (map && initialCoords && initialCoords.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      initialCoords.forEach(c => bounds.extend(new window.google.maps.LatLng(c[0], c[1])));
      map.fitBounds(bounds);
    }
  }, [map, initialCoords]);

  return (
    <div className="relative flex flex-col gap-2">
      <div className="relative z-[1001]">
        <div className="flex items-center bg-slate-800 border border-slate-600 rounded-xl overflow-hidden focus-within:border-teal-500 transition-colors">
          <span className="pl-3 text-slate-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search location (e.g. Karachi Expo Centre)..."
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {searching && <span className="pr-3 text-slate-400 text-xs animate-pulse">Searching...</span>}
          {searchQuery && !searching && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="pr-3 text-slate-400 hover:text-white transition-colors">✕</button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => flyToResult(r)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-start gap-3 border-b border-slate-800 last:border-0"
              >
                <span className="text-teal-400 mt-0.5 shrink-0">📍</span>
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative border border-slate-600 rounded-xl overflow-hidden">
        {!isLoaded ? (
          <div style={mapContainerStyle} className="bg-slate-800 flex items-center justify-center text-slate-500 animate-pulse">Loading Map...</div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={14}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              styles: darkMapStyle,
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false
            }}
          >
            <DrawingManager
              onPolygonComplete={(polygon) => {
                const path = polygon.getPath();
                const coords: [number, number][] = [];
                for (let i = 0; i < path.getLength(); i++) {
                  const latLng = path.getAt(i);
                  coords.push([latLng.lat(), latLng.lng()]);
                }
                polygon.setMap(null); // Remove drawn polygon so we can rely purely on React state
                onBoundaryChange(coords);
              }}
              options={{
                drawingControl: true,
                drawingControlOptions: {
                  position: window.google.maps.ControlPosition.TOP_CENTER,
                  drawingModes: [
                    window.google.maps.drawing.OverlayType.POLYGON
                  ]
                },
                polygonOptions: {
                  fillColor: '#14b8a6',
                  fillOpacity: 0.2,
                  strokeColor: '#14b8a6',
                  strokeWeight: 2,
                  clickable: false,
                  editable: false,
                  zIndex: 1
                }
              }}
            />
            {initialCoords && initialCoords.length > 0 && (
              <Polygon
                paths={initialCoords.map(c => ({ lat: c[0], lng: c[1] }))}
                options={{
                  fillColor: '#14b8a6',
                  fillOpacity: 0.2,
                  strokeColor: '#14b8a6',
                  strokeWeight: 2
                }}
              />
            )}
          </GoogleMap>
        )}
        <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 z-[9] pointer-events-none">
          🖊️ Use toolbar (top-center) to draw the event boundary
        </div>
      </div>
    </div>
  );
}
