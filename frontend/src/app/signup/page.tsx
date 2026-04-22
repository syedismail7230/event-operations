'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    organizationName: '',
    role: 'USER'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'ROOT_ADMIN') {
        router.push('/dashboard/root');
      } else if (data.user.role === 'ORG_ADMIN' || data.user.role === 'MANAGER') {
        router.push('/dashboard/org');
      } else {
        router.push('/dashboard/events');
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#11131a] text-slate-300 font-sans sm:justify-center sm:items-center">
      <div className="w-full max-w-xl h-full sm:h-auto sm:rounded-3xl sm:border sm:border-slate-800 overflow-y-auto relative shadow-2xl flex flex-col bg-[#11131a] p-8 sm:p-12 z-10 no-scrollbar">
        
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-[#ff6b35]/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="flex-1 flex flex-col justify-center relative z-10 pt-12 sm:pt-0">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">Create Account</h1>
            <p className="text-slate-400 text-sm">Join the enterprise command loop.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors" placeholder="john@example.com" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input required type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number <span className="lowercase font-normal text-slate-600">(Optional)</span></label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors" placeholder="+1 (555) 000-0000" />
            </div>

            <div className="border-t border-slate-800 pt-5 mt-5">
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Platform Role</label>
               <select name="role" value={formData.role} onChange={handleChange} className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors mb-4">
                 <option value="USER">User (Attendee)</option>
                 <option value="VOLUNTEER">Field Volunteer</option>
                 <option value="MANAGER">Event Manager</option>
                 <option value="ORG_ADMIN">Organization Administrator</option>
               </select>

               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Organization Name <span className="lowercase font-normal text-slate-600">(Global if blank)</span></label>
               <input type="text" name="organizationName" value={formData.organizationName} onChange={handleChange} className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors" placeholder="Acme Logistics Corp" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[#ff6b35] hover:bg-[#e85a2b] text-white font-bold tracking-widest uppercase py-4 rounded-2xl mt-6 shadow-[0_0_20px_rgba(255,107,53,0.3)] transition-all disabled:opacity-50">
              {loading ? 'INITIALIZING...' : 'Create Account'}
            </button>
            <div className="text-center mt-6">
              <button type="button" onClick={() => router.push('/login')} className="text-[#ff6b35] font-bold text-sm hover:underline">Already have an account? Log in</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
