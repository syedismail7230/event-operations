'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

export default function AttendeeTicket() {
  const [user, setUser] = useState<any>({});
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/public/tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user.id) return null;

  if (loading) {
    return <div className="min-h-[100dvh] bg-[#0a0a0c] flex items-center justify-center text-slate-500 animate-pulse">Loading your tickets...</div>;
  }

  if (tickets.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0c] flex flex-col items-center justify-center text-center p-8">
        <span className="text-6xl mb-4">🎟️</span>
        <h1 className="text-xl font-bold text-white mb-2">No Tickets Yet</h1>
        <p className="text-slate-400 text-sm">Discover and join events on the home page to see your tickets here.</p>
      </div>
    );
  }

  // Display the most recent ticket (or you could map through them with a carousel)
  const activeTicket = tickets[0];

  const qrValue = JSON.stringify({
    userId: user.id,
    eventId: activeTicket.eventId
  });

  return (
    <div className="relative min-h-[100dvh] bg-[#0a0a0c] flex flex-col items-center pt-8 overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 w-full h-96 bg-purple-600/20 blur-[100px] pointer-events-none"></div>

      {/* Lanyard Strings */}
      <div className="absolute top-0 left-1/2 -translate-x-[60px] w-6 h-40 bg-purple-700 origin-top transform -rotate-12 z-0 shadow-[0_0_20px_rgba(126,34,206,0.5)]"></div>
      <div className="absolute top-0 left-1/2 translate-x-[40px] w-6 h-40 bg-purple-900 origin-top transform rotate-12 z-0 shadow-[0_0_20px_rgba(88,28,135,0.5)]"></div>
      
      {/* The Ticket Badge */}
      <div className="relative z-10 mt-32 w-72 bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center">
        
        {/* Lanyard Hole */}
        <div className="absolute -top-3 w-16 h-4 bg-[#0a0a0c] rounded-full border-b-2 border-slate-300"></div>
        {/* Clip */}
        <div className="absolute -top-6 w-8 h-8 rounded-md bg-purple-800 border-2 border-purple-400 z-20"></div>

        <div className="w-full aspect-square bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center p-2 mb-6">
          <QRCode 
            value={qrValue} 
            size={200}
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
          </svg>
          <span className="text-slate-500 font-semibold text-sm truncate max-w-[200px]">{activeTicket.event?.name || 'Local Event'}</span>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900">{user.name || 'Preet Suthar'}</h2>
        
        {/* Badge side cutouts */}
        <div className="absolute top-1/2 -left-3 w-6 h-6 bg-[#0a0a0c] rounded-full"></div>
        <div className="absolute top-1/2 -right-3 w-6 h-6 bg-[#0a0a0c] rounded-full"></div>
      </div>

      {/* Confirmation Message */}
      <div className="mt-12 text-center z-10 px-6">
        <h1 className="text-2xl font-bold text-white mb-2">Your entry is confirmed! 🥳</h1>
        <p className="text-slate-400 text-sm">Scan the QR code to join the conference.</p>
      </div>

      {/* Bottom Action Buttons */}
      <div className="absolute bottom-28 w-full px-8 flex justify-center z-10 items-center">
        {/* Placeholder for future actions */}
      </div>

    </div>
  );
}
