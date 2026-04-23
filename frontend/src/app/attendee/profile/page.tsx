'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendeeProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    emergencyContact: '',
    bloodType: ''
  });
  const [saving, setSaving] = useState(false);
  const [sosStatus, setSosStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(localUser);
    setEditForm({
      name: localUser.name || '',
      phone: localUser.phone || '',
      emergencyContact: localUser.emergencyContact || '',
      bloodType: localUser.bloodType || ''
    });
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/login');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setIsEditing(false);
      } else {
        alert('Failed to update profile');
      }
    } catch (e) {
      alert('Network error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSOS = async () => {
    if (sosStatus === 'sending') return;
    setSosStatus('sending');
    try {
      const token = localStorage.getItem('token');
      
      // Fetch tickets to get active eventId
      const ticketsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tickets = await ticketsRes.json();
      
      if (!tickets || tickets.length === 0) {
        setSosStatus('idle');
        alert("You are not registered for any active events. Cannot send SOS.");
        return;
      }
      
      const activeTicket = tickets[0];
      
      // Get current location if possible
      let lat = null, lng = null;
      if ('geolocation' in navigator) {
        try {
          const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (e) {
          console.warn("Could not get exact location for SOS");
        }
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/emergency`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventId: activeTicket.eventId, lat, lng })
      });

      if (res.ok) {
        setSosStatus('sent');
        alert("🚨 EMERGENCY REPORTED! 🚨\n\nAll nearby volunteers and managers have been alerted. Stay calm, help is on the way.");
        setTimeout(() => setSosStatus('idle'), 10000);
      } else {
        setSosStatus('idle');
        alert("Failed to send SOS. Please find a volunteer immediately.");
      }
    } catch (e) {
      setSosStatus('idle');
      alert("Network error sending SOS.");
    }
  };

  return (
    <div className="min-h-full pb-10 bg-[#11131a]">
      {/* Top Header */}
      <div className="bg-[#1e222d] w-full px-6 pt-12 pb-8 rounded-b-[40px] relative">
        <h1 className="text-3xl font-bold text-white mb-8">Your Profile</h1>
        
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-700 overflow-hidden relative border-4 border-[#1e222d] shadow-[0_0_0_2px_rgba(255,107,53,0.3)] shrink-0">
            <img src={`https://ui-avatars.com/api/?name=${user.name || 'User'}&background=random&size=128`} alt="avatar" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-[#1e222d] rounded-full"></div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.name || 'Preet Suthar'}</h2>
            <p className="text-[#ff6b35] font-semibold text-sm">{user.role || 'ATTENDEE'}</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-8 space-y-6">
        
        {/* Personal Details Card */}
        <div className="bg-[#1e222d] rounded-3xl p-6 shadow-lg border border-slate-800">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Personal Information
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Email Address (Read Only)</p>
              <p className="text-slate-200 font-medium">{user.email || 'user@example.com'}</p>
            </div>
            <div className="w-full h-px bg-slate-800"></div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Name</p>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-[#ff6b35]"
                />
              ) : (
                <p className="text-slate-200 font-medium">{user.name || 'Not provided'}</p>
              )}
            </div>
            <div className="w-full h-px bg-slate-800"></div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Phone Number</p>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.phone} 
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-[#ff6b35]"
                  placeholder="+1 (555) 000-0000"
                />
              ) : (
                <p className="text-slate-200 font-medium">{user.phone || 'Not provided'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Emergency & Medical */}
        <div className="bg-[#1e222d] rounded-3xl p-6 shadow-lg border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              Safety Information
            </h3>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-md">Optional</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Emergency Contact</p>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.emergencyContact} 
                  onChange={(e) => setEditForm({...editForm, emergencyContact: e.target.value})}
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-[#ff6b35]"
                  placeholder="Jane Doe • +1 555-999-9999"
                />
              ) : (
                <p className="text-slate-200 font-medium">{user.emergencyContact || 'Not provided'}</p>
              )}
            </div>
            <div className="w-full h-px bg-slate-800"></div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Blood Type</p>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.bloodType} 
                  onChange={(e) => setEditForm({...editForm, bloodType: e.target.value})}
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-[#ff6b35]"
                  placeholder="O Positive (O+)"
                />
              ) : (
                <p className="text-slate-200 font-medium">{user.bloodType || 'Not provided'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-[#ff6b35] hover:bg-[#e85a2b] text-white font-bold rounded-2xl transition-colors shadow-lg">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setIsEditing(false)} className="w-full py-4 bg-[#2a2f3d] hover:bg-[#343a4a] text-white font-bold rounded-2xl transition-colors">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="w-full py-4 bg-[#2a2f3d] hover:bg-[#343a4a] text-white font-bold rounded-2xl transition-colors">
                Edit Profile
              </button>
              <button onClick={handleSignOut} className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-2xl border border-red-500/20 transition-colors">
                Sign Out
              </button>
            </>
          )}
        </div>

        {/* SOS Emergency Button */}
        <div className="pt-8 pb-4 flex justify-center">
          <button 
            onClick={handleSOS}
            className={`px-12 py-4 rounded-full font-black text-white shadow-2xl transition-all transform active:scale-95 flex items-center gap-3 ${sosStatus === 'sent' ? 'bg-green-600' : 'bg-red-600 animate-pulse hover:bg-red-700'}`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            {sosStatus === 'sending' ? 'SENDING...' : sosStatus === 'sent' ? 'SOS SENT' : 'SOS EMERGENCY'}
          </button>
        </div>

      </div>
    </div>
  );
}

