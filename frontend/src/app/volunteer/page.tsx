"use client";
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useState } from 'react';

export default function VolunteerApp() {
  const [status, setStatus] = useState('Standby');
  const [loading, setLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  // Mock Event and Attendee just for demonstration
  const eventId = '1'; 

  const handleScan = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Simulated scan of an attendee's QR
      const scannedAttendeeId = `USR_${Math.floor(Math.random() * 9000) + 1000}`;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
           eventId, 
           attendeeId: scannedAttendeeId,
           method: 'QR_SCAN'
        })
      });
      
      if(response.ok) {
         setStatus(`Checked In: ${scannedAttendeeId}`);
         setTimeout(() => setStatus('Standby'), 3000);
      }
    } catch(err) {
       setStatus('Error checking in');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        
        <div className="text-center">
           <h2 className="text-xl font-bold">Volunteer Ops App</h2>
           <p className="text-slate-400">Section B Entry Gate</p>
        </div>

        {/* Big Action Button for Scanning */}
        <button 
          onClick={handleScan}
          disabled={loading}
          className="w-full aspect-square bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex flex-col items-center justify-center p-8 shadow-[0_0_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all outline-none"
        >
          <div className="text-6xl mb-2">📷</div>
          <div className="text-2xl font-bold">SCAN QR</div>
        </button>

        {/* Status Indicator */}
        <div className="text-center bg-slate-800 rounded-xl p-4 border border-slate-700">
           <span className={`text-sm font-semibold tracking-wider ${
             status === 'Standby' ? 'text-slate-400' : 'text-green-400'
           }`}>
             {status}
           </span>
        </div>

        {/* Push to talk button mockup */}
        <button 
           onMouseDown={() => setIsTalking(true)}
           onMouseUp={() => setIsTalking(false)}
           onTouchStart={() => setIsTalking(true)}
           onTouchEnd={() => setIsTalking(false)}
           className={`w-full py-6 rounded-2xl flex items-center justify-center gap-3 border transition-colors duration-75 select-none ${
             isTalking ? 'bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-slate-800 border-slate-700'
           }`}
        >
           <span className="text-3xl">🎙️</span>
           <span className="text-xl font-medium">{isTalking ? 'TRANSMITTING...' : 'PUSH TO TALK'}</span>
        </button>

      </div>
    </div>
  );
}

