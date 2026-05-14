'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Activity } from 'lucide-react';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Tjek din email for at bekræfte din konto (eller du logges ind automatisk, hvis email bekræftelse er slået fra i Supabase).');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Der opstod en fejl');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-center items-center p-6 text-white max-w-md mx-auto">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl w-full relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none z-0"></div>
        
        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-orange-500 to-yellow-400 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20 mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter">JAAFIT <span className="text-orange-500">PRO</span></h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
            {isSignUp ? 'Opret konto' : 'Log ind på din konto'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="relative z-10 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500 transition-colors"
              placeholder="din@email.dk"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Adgangskode</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && <p className="text-red-400 text-sm mt-2 font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</p>}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl mt-4 shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Vent venligst...' : isSignUp ? 'OPRET KONTO' : 'LOG IND'}
          </button>
        </form>

        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="relative z-10 w-full mt-6 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {isSignUp ? 'Har du allerede en konto? Log ind' : 'Mangler du en konto? Opret dig'}
        </button>
      </div>
    </div>
  );
}
