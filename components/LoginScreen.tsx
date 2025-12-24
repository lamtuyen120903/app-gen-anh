import React, { useState } from 'react';
import { User } from '../types';
import { loginUser } from '../services/googleBackend';
import { Lock, User as UserIcon, ArrowRight, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Hardcode Admin fallback if backend is not set up yet (for safety)
      // Updated password as requested
      if (username === 'ducngokhong' && password === '12345@abcd' && !window.location.href.includes('googleusercontent')) {
         onLogin({ id: 'ducngokhong', name: 'Duc Ngo Khong', role: 'ADMIN' });
         return;
      }

      const result = await loginUser(username, password);
      
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Invalid Credentials');
      }
    } catch (e) {
      setError('Login failed. Check internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 relative z-0">
        <div className="text-center mb-8">
           <h1 className="font-extrabold text-3xl text-slate-900 mb-2">AdsGen<span className="text-red-600">AI</span></h1>
           <p className="text-slate-500 text-sm uppercase tracking-wider font-bold">Internal Access Only</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">User ID</label>
            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-20">
                 <UserIcon size={18} />
               </div>
               <input
                 type="text"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition outline-none relative z-10"
                 placeholder="Enter your ID"
                 autoComplete="username"
                 autoFocus
               />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-20">
                 <Lock size={18} />
               </div>
               <input
                 type={showPassword ? "text" : "password"}
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition outline-none relative z-10"
                 placeholder="Enter password"
                 autoComplete="current-password"
               />
               <button
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 z-20 focus:outline-none"
               >
                 {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
               </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-red-600 transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>Login <ArrowRight size={20} /></>}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-400">
          Powered by ABC Digi AI Core
        </div>
      </div>
    </div>
  );
};