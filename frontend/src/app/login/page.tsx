"use client";
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'ROOT_ADMIN') {
        router.push('/dashboard/root');
      } else if (data.user.role === 'ORG_ADMIN') {
        router.push('/dashboard/org');
      } else if (data.user.role === 'VOLUNTEER') {
        // If already has org assigned, go straight to volunteer dashboard
        if (data.user.organizationId && data.user.status === 'ACTIVE') {
          router.push('/dashboard/volunteer');
        } else {
          router.push('/volunteer/join');
        }
      } else if (data.user.role === 'ATTENDEE' || data.user.role === 'USER') {
        router.push('/attendee');
      } else {
        router.push('/volunteer/join');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      
      const response = await fetch('${process.env.NEXT_PUBLIC_API_URL}/auth/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.status === 'PENDING') {
           setError(data.error);
           auth.signOut();
           return;
        }
        throw new Error(data.error || 'Failed to sync with secure server');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'ROOT_ADMIN') {
        router.push('/dashboard/root');
      } else if (data.user.role === 'ORG_ADMIN') {
        router.push('/dashboard/org');
      } else if (data.user.role === 'VOLUNTEER') {
        if (data.user.organizationId && data.user.status === 'ACTIVE') {
          router.push('/dashboard/volunteer');
        } else {
          router.push('/volunteer/join');
        }
      } else if (data.user.role === 'ATTENDEE' || data.user.role === 'USER') {
        router.push('/attendee');
      } else {
        router.push('/volunteer/join');
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during login');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#11131a] text-slate-300 font-sans sm:justify-center sm:items-center">
      <div className="w-full max-w-lg h-full sm:h-auto sm:rounded-3xl sm:border sm:border-slate-800 overflow-y-auto relative shadow-2xl flex flex-col bg-[#11131a] p-8 sm:p-12 z-10">
        
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-[#ff6b35]/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="flex-1 flex flex-col justify-center relative z-10 pt-12 sm:pt-0">
          
          {/* Logo / Header */}
          <div className="mb-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#ff6b35] to-[#ff8c42] rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-[#ff6b35]/30 mb-6 transform -rotate-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">Welcome Back</h1>
            <p className="text-slate-400 font-medium">Log in to manage your event operations.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLocalLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1e222d] text-white border border-slate-800 rounded-2xl px-4 py-4 focus:outline-none focus:border-[#ff6b35] transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-[#ff6b35] hover:bg-[#e85a2b] text-white font-bold rounded-2xl py-4 mt-8 transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(255,107,53,0.3)]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#11131a] text-slate-500">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-all outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loading ? 'Authenticating...' : 'Sign in with Google'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-slate-400">
              Don't have an account?{' '}
              <a href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Sign up here
              </a>
            </p>
            <p className="text-xs text-slate-600">
              Authorized personnel only. All access is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
