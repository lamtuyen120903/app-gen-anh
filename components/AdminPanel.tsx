import React, { useState, useEffect } from 'react';
import { User, UsageSummary } from '../types';
import { getAllUsers, manageUser, getUsageStats } from '../services/googleBackend';
import { X, UserPlus, Trash2, RefreshCcw, Shield, Key, CheckCircle2, DollarSign, Image as ImageIcon } from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, onClose }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [usageStats, setUsageStats] = useState<UsageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Load Users
    const resUsers = await getAllUsers(currentUser.id);
    if (resUsers.success && resUsers.users) {
      setUsers(resUsers.users);
    } else {
      alert("Failed to load users: " + resUsers.message);
    }

    // Load Usage Stats for Admin View (Passing 'ADMIN' role to get all)
    const resStats = await getUsageStats(currentUser.id, 'ADMIN');
    if (resStats.success && resStats.summary) {
        setUsageStats(resStats.summary);
    }

    setLoading(false);
  };

  const getStatsForUser = (userId: string) => {
      const stat = usageStats.find(s => s.userId === userId);
      return stat || { totalImages: 0, totalCost: 0 };
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName || !newPass) return;
    
    if (users.find(u => u.id === newId)) {
        alert("User ID already exists!");
        return;
    }

    setLoading(true);
    const res = await manageUser(currentUser.id, {
        id: newId,
        name: newName,
        password: newPass,
        role: newRole
    }, 'ADD');

    if (res.success) {
        setNewId(''); setNewName(''); setNewPass('');
        loadData();
    } else {
        alert(res.message);
    }
    setLoading(false);
  };

  const handleDelete = async (targetId: string) => {
    if (!window.confirm(`Are you sure you want to delete ${targetId}?`)) return;
    if (targetId === currentUser.id) { alert("Cannot delete yourself."); return; }

    setLoading(true);
    const res = await manageUser(currentUser.id, { id: targetId }, 'DELETE');
    if (res.success) loadData();
    else alert(res.message);
    setLoading(false);
  };

  const handleResetPass = async (targetId: string) => {
    const newP = prompt(`Enter new password for ${targetId}:`);
    if (!newP) return;

    setLoading(true);
    const res = await manageUser(currentUser.id, { id: targetId, password: newP }, 'UPDATE');
    if (res.success) alert("Password updated.");
    else alert(res.message);
    setLoading(false);
  };

  const renderInputLabel = (label: string) => (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <div className="bg-red-100 p-2.5 rounded-xl shadow-sm"><Shield className="text-red-600" size={24} /></div>
             <div>
                <h2 className="text-xl font-bold text-slate-900">Admin Management</h2>
                <p className="text-sm text-slate-500">Manage users, permissions, and cost tracking</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-full transition"><X size={24}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* User List Column */}
            <div className="flex-1 overflow-y-auto p-6 border-r border-slate-100 bg-white">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-slate-800">User Directory ({users.length})</h3>
                    <button onClick={loadData} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition"><RefreshCcw size={18} /></button>
                </div>
                
                {loading && users.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">Loading directory...</div>
                ) : (
                    <div className="space-y-3">
                        {users.map(u => {
                            const stats = getStatsForUser(u.id);
                            return (
                                <div key={u.id} className="p-4 border border-slate-200 rounded-xl flex justify-between items-center bg-white hover:border-red-200 hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${u.role === 'ADMIN' ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-slate-400'}`}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                                {u.name} 
                                                {u.id === currentUser.id && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">You</span>}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                <span className="font-mono bg-slate-50 px-1 rounded border border-slate-100">@{u.id}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${u.role === 'ADMIN' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                    {u.role}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Cost Column */}
                                    <div className="flex flex-col items-end mr-4 min-w-[100px]">
                                        <div className="flex items-center gap-1 font-bold text-slate-700">
                                            <DollarSign size={14} className="text-green-600"/> {stats.totalCost.toFixed(3)}
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1">
                                            <ImageIcon size={12}/> {stats.totalImages} imgs
                                        </div>
                                    </div>

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleResetPass(u.id)} title="Reset Password" className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"><Key size={18} /></button>
                                        {u.id !== currentUser.id && (
                                            <button onClick={() => handleDelete(u.id)} title="Delete User" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add User Form Column */}
            <div className="w-96 bg-slate-50 p-8 overflow-y-auto border-l border-slate-100 shadow-inner">
                <div className="mb-6 flex items-center gap-2 text-slate-800">
                    <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 text-red-600">
                        <UserPlus size={20} />
                    </div>
                    <h3 className="font-bold text-lg">Add New User</h3>
                </div>
                
                <form onSubmit={handleAddUser} className="space-y-5">
                    <div>
                        {renderInputLabel("User ID (Login)")}
                        <input 
                            value={newId} 
                            onChange={e => setNewId(e.target.value)} 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition text-sm text-slate-800 placeholder:text-slate-400 shadow-sm" 
                            placeholder="e.g. john.doe" 
                        />
                    </div>
                    
                    <div>
                        {renderInputLabel("Full Name")}
                        <input 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)} 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition text-sm text-slate-800 placeholder:text-slate-400 shadow-sm" 
                            placeholder="e.g. John Doe" 
                        />
                    </div>
                    
                    <div>
                        {renderInputLabel("Initial Password")}
                        <input 
                            value={newPass} 
                            onChange={e => setNewPass(e.target.value)} 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition text-sm text-slate-800 placeholder:text-slate-400 shadow-sm" 
                            type="text"
                            placeholder="Set a temporary password"
                        />
                    </div>
                    
                    <div>
                        {renderInputLabel("Role Permission")}
                        <div className="relative">
                            <select 
                                value={newRole} 
                                onChange={(e: any) => setNewRole(e.target.value)} 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition text-sm text-slate-800 appearance-none shadow-sm cursor-pointer"
                            >
                                <option value="USER">User (Standard Access)</option>
                                <option value="ADMIN">Admin (Full Access)</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={loading || !newId || !newName || !newPass} 
                            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-red-500/20 transform active:scale-[0.98]"
                        >
                            {loading ? 'Processing...' : <><CheckCircle2 size={18} /> Create Account</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};
