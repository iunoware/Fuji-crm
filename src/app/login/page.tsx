"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(username, password);
      router.push('/'); 
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="flex h-screen items-center justify-center bg-cover bg-center bg-no-repeat relative p-5 select-none"
      style={{ backgroundImage: `url('/images/login_background.jpeg')` }}
    >
      {/* Slightly darker overlay to make the white text pop beautifully against the bright sky */}
      <div className="absolute inset-0 bg-black/30"></div>

      {/* ULTRA-TRANSPARENT GLASSMORPHISM CARD */}
      <div className="relative z-10 w-full max-w-[420px] rounded-3xl p-10 bg-gradient-to-br from-white/10 to-white/1 shadow-2xl border border-white/20 backdrop-blur-lg mx-5">
        
        <div className="text-center mb-8">
          <div className="bg-white w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/logos/logo.jpg" alt="Fuji Solar Logo" className="w-[80%] h-auto object-contain" />
          </div>
          
          <h2 className="m-0 text-3xl text-white font-extrabold mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            Welcome Back
          </h2>
          <p className="m-0 text-slate-200 text-[15px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            Sign in to the Fuji Solar ERP
          </p>
        </div>

        {error && (
          <div className="bg-red-600/20 backdrop-blur-md text-red-300 p-3 rounded-xl text-xs mb-5 text-center border border-red-400/30 font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-bold text-white mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              className="w-full p-3.5 px-4 bg-black/20 border border-white/30 rounded-xl text-white text-sm font-medium outline-none shadow-inner transition-all duration-300 focus:bg-black/40 focus:border-white/60"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-white mb-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="w-full p-3.5 px-4 bg-black/20 border border-white/30 rounded-xl text-white text-sm font-medium outline-none shadow-inner transition-all duration-300 focus:bg-black/40 focus:border-white/60"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading} 
            className="bg-gradient-to-r from-red-500/90 to-red-600/90 text-white border border-white/20 p-3.5 rounded-xl font-bold text-base tracking-wide cursor-pointer flex justify-center mt-3 shadow-[0_4px_15px_rgba(220,38,38,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(220,38,38,0.6)] disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
