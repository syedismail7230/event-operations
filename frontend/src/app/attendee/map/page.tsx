'use client';
import dynamic from 'next/dynamic';

const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-500 bg-[#11131a]">Initializing map...</div>
});

export default function AttendeeMap() {
  return (
    <div className="h-full w-full bg-[#11131a]">
      <MapClient />
    </div>
  );
}
