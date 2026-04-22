const fs = require('fs');
const path = require('path');

const routes = [
  { name: 'events', title: 'Event Management Core' },
  { name: 'attendees', title: 'Attendee Registration Pipeline' },
  { name: 'personnel', title: 'Volunteer & Personnel Allocation' },
  { name: 'checkins', title: 'Real-time Check-In Logs' },
  { name: 'map', title: 'Live Geo-Fencing & Tracking' },
  { name: 'comms', title: 'Targeted Communication System' },
  { name: 'incidents', title: 'Issue & Incident Tracker' },
  { name: 'ptt', title: 'WebRTC Walkie-Talkie Channels' },
  { name: 'analytics', title: 'Strategic Analytics & Reports' },
  { name: 'billing', title: 'Subscription & Usage Limits' },
  { name: 'roles', title: 'Custom Role & Permission Matrix' },
  { name: 'audit', title: 'Organization Audit Logs' },
  { name: 'settings', title: 'Organization Profile Settings' },
  { name: 'support', title: 'Root Support & Helpdesk' }
];

const baseDir = path.join(__dirname, 'src/app/dashboard/org');

routes.forEach(route => {
  const dir = path.join(baseDir, route.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const file = path.join(dir, 'page.tsx');
  const content = `'use client';

export default function ${route.name.charAt(0).toUpperCase() + route.name.slice(1)}Module() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="z-10 bg-slate-800/50 backdrop-blur-md border border-slate-700 p-10 rounded-2xl shadow-2xl max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">
          ${route.title}
        </h1>
        <p className="text-slate-400 mb-8">
          This enterprise module is currently under active construction in Phase 1. 
          It will feature real-time data visualization and zero-trust operational controls.
        </p>
        
        <div className="w-full bg-slate-900/50 rounded-lg p-6 border border-slate-700/50">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-slate-700 h-10 w-10"></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="h-2 bg-slate-700 rounded w-3/4"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-2 bg-slate-700 rounded col-span-2"></div>
                  <div className="h-2 bg-slate-700 rounded col-span-1"></div>
                </div>
                <div className="h-2 bg-slate-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(file, content);
});

console.log('Successfully scaffolded 14 modules.');
