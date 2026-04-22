'use client';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const libraries: ("drawing")[] = ["drawing"];
import { useState, useCallback } from 'react';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
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

export default function Map({ points }: { points: any[] }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const [activeMarker, setActiveMarker] = useState<number | null>(null);

  const defaultCenter = points.length > 0 
    ? { lat: points[0].lat, lng: points[0].lng } 
    : { lat: 20, lng: 0 };
    
  const zoomLevel = points.length > 0 ? 5 : 2;

  if (!isLoaded) return <div className="h-full w-full bg-[#0b0f19] flex items-center justify-center text-slate-500">Loading Map...</div>;

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={defaultCenter}
      zoom={zoomLevel}
      options={{
        styles: darkMapStyle,
        disableDefaultUI: true,
        zoomControl: true,
      }}
    >
      {points.map((pt, i) => (
        <Marker
          key={i}
          position={{ lat: pt.lat, lng: pt.lng }}
          onClick={() => setActiveMarker(i)}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: pt.type === 'event' ? 10 : 8,
            fillColor: pt.type === 'event' ? "#ef4444" : "#14b8a6",
            fillOpacity: 0.8,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }}
        >
          {activeMarker === i && (
            <InfoWindow position={{ lat: pt.lat, lng: pt.lng }} onCloseClick={() => setActiveMarker(null)}>
              <div className="text-black p-1">
                <div className="font-bold">{pt.name}</div>
                <div className="text-xs text-gray-600">
                  {pt.type === 'event' ? 'Live Event Geofence Core' : 'User Telemetry Ping'}
                </div>
              </div>
            </InfoWindow>
          )}
        </Marker>
      ))}
    </GoogleMap>
  );
}
