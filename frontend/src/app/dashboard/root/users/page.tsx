'use client';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;

    if (!token || userRole !== 'ROOT_ADMIN') {
      router.push('/login');
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/all-users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setUsers(await res.json());
        }
      } catch (error) {
        console.error('Fetch users failed:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [router]);

  const handleModifyIAM = async (userId: string, action: string, newRole?: string) => {
    if (!confirm(`Are you sure you want to execute ${action} on this identity?`)) return;

    try {
      const res = await fetch('${process.env.NEXT_PUBLIC_API_URL}/dashboard/root/users/iam', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, action, role: newRole })
      });
      
      if (res.ok) {
        if (action === 'FORCE_LOGOUT' || action === 'SUSPEND') {
          setUsers(users.map(u => u.id === userId ? { ...u, status: 'SUSPENDED' } : u));
        } else if (action === 'ACTIVATE') {
          setUsers(users.map(u => u.id === userId ? { ...u, status: 'ACTIVE' } : u));
        } else if (action === 'CHANGE_ROLE') {
          setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        }
      } else {
        alert('Failed to modify user IAM');
      }
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-blue-500 font-mono">LOADING IDENTITY REGISTRY...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white font-sans">
       <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Global Identity & Access Management</h1>
       <p className="text-gray-500 mt-2 text-sm font-mono tracking-wide mb-8 border-b border-gray-800 pb-6">Root Authority User Governance</p>

       <div className="bg-gray-800/40 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
         <table className="w-full text-left border-collapse">
           <thead>
             <tr className="bg-gray-900 border-b border-gray-700 text-xs text-gray-400 uppercase tracking-widest leading-loose">
               <th className="py-4 px-6 font-semibold">User Identity</th>
               <th className="py-4 px-6 font-semibold">Associated Tenant</th>
               <th className="py-4 px-6 font-semibold">IAM Role</th>
               <th className="py-4 px-6 font-semibold">System Status</th>
               <th className="py-4 px-6 text-right font-semibold">Execution Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-800/50">
             {users.map(user => (
               <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                 <td className="py-4 px-6">
                   <div className="font-semibold text-gray-200">{user.name}</div>
                   <div className="text-xs text-gray-500 font-mono mt-1">{user.email}</div>
                 </td>
                 <td className="py-4 px-6 text-gray-300">
                   {user.organization?.name ? (
                     <span className="bg-gray-700/50 px-2 py-1 rounded text-xs border border-gray-600">{user.organization.name}</span>
                   ) : (
                     <span className="italic text-gray-600 text-xs text-center w-full block">None / System</span>
                   )}
                 </td>
                 <td className="py-4 px-6">
                   <select 
                     value={user.role} 
                     onChange={(e) => handleModifyIAM(user.id, 'CHANGE_ROLE', e.target.value)}
                     disabled={user.role === 'ROOT_ADMIN'}
                     className={`bg-transparent text-xs font-mono px-3 py-1 rounded border outline-none cursor-pointer
                       ${user.role === 'ROOT_ADMIN' ? 'border-red-500/50 text-red-400' : 
                         user.role === 'ORG_ADMIN' ? 'border-teal-500/50 text-teal-400' : 
                         'border-blue-500/50 text-blue-400'}`}
                   >
                     <option value="ATTENDEE" className="bg-gray-900">ATTENDEE</option>
                     <option value="VOLUNTEER" className="bg-gray-900">VOLUNTEER</option>
                     <option value="ORG_ADMIN" className="bg-gray-900">ORG_ADMIN</option>
                     <option value="ROOT_ADMIN" className="bg-gray-900" disabled>ROOT_ADMIN</option>
                   </select>
                 </td>
                 <td className="py-4 px-6">
                   {user.status === 'SUSPENDED' ? (
                      <span className="text-xs text-red-500 border border-red-500/20 bg-red-500/10 px-2 py-1 rounded">SUSPENDED</span>
                   ) : user.status === 'PENDING' ? (
                      <span className="text-xs text-yellow-500 border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 rounded">PENDING</span>
                   ) : (
                      <span className="text-xs text-green-500 border border-green-500/20 bg-green-500/10 px-2 py-1 rounded">ACTIVE</span>
                   )}
                 </td>
                 <td className="py-4 px-6 text-right">
                    {user.status !== 'SUSPENDED' ? (
                      <button 
                        onClick={() => handleModifyIAM(user.id, 'FORCE_LOGOUT')}
                        disabled={user.role === 'ROOT_ADMIN'}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1 rounded text-xs transition-colors font-semibold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        FORCE DROP
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleModifyIAM(user.id, 'ACTIVATE')}
                        className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 px-3 py-1 rounded text-xs transition-colors font-semibold tracking-wider cursor-pointer"
                      >
                        RESTORE
                      </button>
                    )}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}
