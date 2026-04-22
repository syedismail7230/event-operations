'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polygon } from '@react-google-maps/api';

const libraries: ("drawing")[] = ["drawing"];

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#11131a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#11131a" }] },
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

export default function MapClient({ initialLat = 0, initialLng = 0 }) {
  const [position, setPosition] = useState<{lat: number, lng: number}>({lat: initialLat, lng: initialLng});
  const [tickets, setTickets] = useState<any[]>([]);
  const [geoFence, setGeoFence] = useState<{lat: number, lng: number}[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  useEffect(() => {
    // Start tracking user location
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // Fetch user's registered events to get the active event's geofence
    const fetchTickets = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/public/tickets', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTickets(data);
          
          // If the user has an active ticket and that event has a geofence, parse it
          if (data.length > 0 && data[0].event?.geoBoundary) {
            try {
              const boundaryStr = data[0].event.geoBoundary;
              const coords = JSON.parse(boundaryStr);
              // Convert [lat, lng] array to {lat, lng} objects for Google Maps
              const formattedCoords = coords.map((coord: [number, number]) => ({
                lat: coord[0],
                lng: coord[1]
              }));
              setGeoFence(formattedCoords);
            } catch (e) {
              console.error("Failed to parse geofence", e);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchTickets();

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  // Fit bounds when map or geoFence changes
  useEffect(() => {
    if (map && geoFence.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      geoFence.forEach((coord) => {
        bounds.extend(new window.google.maps.LatLng(coord.lat, coord.lng));
      });
      map.fitBounds(bounds);
    }
  }, [map, geoFence]);

  if (!isLoaded) return <div className="h-full flex items-center justify-center text-slate-500">Loading Map...</div>;
  if (position.lat === 0) return <div className="h-full flex items-center justify-center text-slate-500">Locating...</div>;

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-0 left-0 w-full p-4 z-10 pointer-events-none">
        <div className="bg-[#1e222d]/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-700 pointer-events-auto">
          <h2 className="text-white font-bold mb-1">Live Map</h2>
          <p className="text-slate-400 text-xs">Your location is shared securely for event safety operations.</p>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={position}
        zoom={17}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy' // Good for mobile
        }}
      >
        {/* Draw the event geofence if available */}
        {geoFence.length > 0 && (
          <Polygon
            paths={geoFence}
            options={{
              fillColor: "#ff6b35",
              fillOpacity: 0.1,
              strokeColor: "#ff6b35",
              strokeOpacity: 0.8,
              strokeWeight: 3,
            }}
          />
        )}

        {/* User's live location */}
        <Marker 
          position={position}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }}
        />
      </GoogleMap>
    </div>
  );
}
