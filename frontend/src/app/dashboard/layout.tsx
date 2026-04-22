"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import to prevent SSR issues (uses browser APIs: geolocation, WebSocket)
const GeoFenceTracker = dynamic(() => import('./org/components/GeoFenceTracker'), { ssr: false });
const NotificationBell = dynamic(() => import('../../components/NotificationBell'), { ssr: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      window.location.href = '/login';
    }
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const roleNavItems: Record<string, { label: string; href: string, icon?: string }[]> = {
    ROOT_ADMIN: [
      { label: 'Overview', href: '/dashboard/root', icon: '📊' },
      { label: 'Organizations', href: '/dashboard/root/organizations', icon: '🏢' },
      { label: 'Users & IAM', href: '/dashboard/root/users', icon: '👥' },
      { label: 'Global Events', href: '/dashboard/root/events', icon: '📍' },
      { label: 'NOC Monitoring', href: '/dashboard/root/monitoring', icon: '📡' },
      { label: 'Subscriptions', href: '/dashboard/root/billing', icon: '💳' },
      { label: 'Feature Toggles', href: '/dashboard/root/features', icon: '⚙️' },
      { label: 'Audit Logs', href: '/dashboard/root/audit', icon: '📋' },
      { label: 'System Health', href: '/dashboard/root/health', icon: '🖥️' },
      { label: 'Notifications', href: '/dashboard/root/notifications', icon: '📣' },
      { label: 'Security', href: '/dashboard/root/security', icon: '🛡️' },
      { label: 'Support Tickets', href: '/dashboard/root/support', icon: '🎫' },
      { label: 'Platform Settings', href: '/dashboard/root/settings', icon: '🔧' },
    ],
    ORG_ADMIN: [
      { label: 'Overview', href: '/dashboard/org', icon: '📈' },
      { label: 'Event Management', href: '/dashboard/org/events', icon: '📅' },
      { label: 'Attendees & Registrations', href: '/dashboard/org/attendees', icon: '🎟️' },
      { label: 'Personnel & Volunteers', href: '/dashboard/org/personnel', icon: '👷' },
      { label: 'Access Codes', href: '/dashboard/org/access-codes', icon: '🔑' },
      { label: 'Geo Exceptions', href: '/dashboard/org/geo-exceptions', icon: '🛡️' },
      { label: 'Check-In Logs', href: '/dashboard/org/checkins', icon: '✅' },
      { label: 'Live Map Tracking', href: '/dashboard/org/map', icon: '🗺️' },
      { label: 'Communications', href: '/dashboard/org/comms', icon: '💬' },
      { label: 'Issue Management', href: '/dashboard/org/incidents', icon: '🚨' },
      { label: 'Walkie-Talkie (PTT)', href: '/dashboard/org/ptt', icon: '📻' },
      { label: 'Analytics & Reports', href: '/dashboard/org/analytics', icon: '📊' },
      { label: 'Billing & Limits', href: '/dashboard/org/billing', icon: '💳' },
      { label: 'Role Permissions', href: '/dashboard/org/roles', icon: '🔐' },
      { label: 'Audit Logs', href: '/dashboard/org/audit', icon: '📋' },
      { label: 'Profile Settings', href: '/dashboard/org/settings', icon: '⚙️' },
      { label: 'Support Helpdesk', href: '/dashboard/org/support', icon: '🎫' },
    ],
    MANAGER: [
      { label: 'Event Ops', href: '/dashboard/manager' },
    ],
    VOLUNTEER: [
      { label: 'My Dashboard', href: '/dashboard/volunteer', icon: '🏠' },
      { label: 'Walkie-Talkie', href: '/dashboard/org/ptt', icon: '📻' },
      { label: 'Live Map', href: '/dashboard/org/map', icon: '🗺️' },
      { label: 'Join Event', href: '/volunteer/join', icon: '🎟️' },
    ],
  };

  if (!user) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-mono text-sm tracking-widest animate-pulse">AUTHORIZING COMMAND LAYER...</div>;

  const navItems = roleNavItems[user.role] || [];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
      
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed md:relative w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col z-30 shadow-2xl transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Operations OS
          </h1>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3 mt-2">
            {user.role.replace('_', ' ')}
          </div>
          {navItems.map((item) => {
             const isActive = pathname === item.href;
             return (
               <Link 
                 key={item.href} 
                 href={item.href}
                 className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                   isActive 
                     ? 'bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20 shadow-inner' 
                     : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                 }`}
               >
                 <span className="text-lg opacity-80">{item.icon || '❖'}</span>
                 {item.label}
               </Link>
             );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex flex-col gap-2">
             <div className="text-sm font-medium truncate">{user.name}</div>
             <button 
               className="text-left text-sm text-red-400 hover:text-red-300 transition-colors"
               onClick={() => {
                 localStorage.removeItem('token');
                 localStorage.removeItem('user');
                 window.location.href = '/login';
               }}
             >
               Sign out
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 z-10">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-slate-400 hover:text-white p-2 -ml-2"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h2 className="text-lg font-medium hidden sm:block">Dashboard</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Notification Bell — all dashboard roles */}
            {(user.role === 'ORG_ADMIN' || user.role === 'MANAGER' || user.role === 'VOLUNTEER') && (
              <NotificationBell />
            )}
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs md:text-sm text-slate-400">System Online</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#0B1120] p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>

      {/* Global geo-fence tracker + violation alerts — only for org users */}
      {(user.role === 'ORG_ADMIN' || user.role === 'MANAGER' || user.role === 'VOLUNTEER' || user.role === 'USER') && (
        <GeoFenceTracker />
      )}
    </div>
  );
}
