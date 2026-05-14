'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Dumbbell, Settings, CalendarDays, RefreshCw, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Exercise = { id: string; name: string; category: string | null };
type ProgramDay = { label: string; exercises: Exercise[] };

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildProgram(exercises: Exercise[]): ProgramDay[] {
  const s = shuffle(exercises);
  const n = Math.ceil(s.length / 3);
  return [
    { label: 'Dag 1', exercises: s.slice(0, n) },
    { label: 'Dag 2', exercises: s.slice(n, n * 2) },
    { label: 'Dag 3', exercises: s.slice(n * 2) },
  ].filter(d => d.exercises.length > 0);
}

// Mandag i indeværende uge
function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export default function HomePage() {
  const [user, setUser]             = useState<User | null>(null);
  const [exercises, setExercises]   = useState<Exercise[]>([]);
  const [program, setProgram]       = useState<ProgramDay[] | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('jaafit_program');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasLoaded, setHasLoaded]   = useState(false);
  const [completedDays, setCompletedDays] = useState<string[]>([]);

  const loadCompletedDays = useCallback(async (uid: string) => {
    const monday = getMondayISO();
    const { data } = await supabase
      .from('workout_sessions')
      .select('day_label')
      .eq('user_id', uid)
      .gte('completed_date', monday);
    if (data) setCompletedDays(data.map(r => r.day_label));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const [exRes] = await Promise.all([
          supabase.from('exercises').select('id, name, category').order('name'),
          loadCompletedDays(user.id),
        ]);
        if (exRes.data) setExercises(exRes.data);
      }
      setHasLoaded(true);
    })();
  }, [loadCompletedDays]);

  // Genindlæs completed days når vi vender tilbage til siden
  useEffect(() => {
    const handleFocus = () => { if (user) loadCompletedDays(user.id); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, loadCompletedDays]);

  function handleGenerate() {
    if (exercises.length === 0) return;
    setIsGenerating(true);
    setTimeout(() => {
      const newProgram = buildProgram(exercises);
      setProgram(newProgram);
      localStorage.setItem('jaafit_program', JSON.stringify(newProgram));
      setIsGenerating(false);
    }, 600);
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??';

  const allDays = program ?? [];
  const completedCount = allDays.filter(d => completedDays.includes(d.label)).length;

  return (
    <div className="pb-24 pt-8 px-4 max-w-md mx-auto min-h-screen flex flex-col relative text-white">

      <header className="mb-8 flex items-center justify-between z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter">Gajhedes Træning</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Ingen undskyldning, bare igang</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-yellow-400 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20">
          {initials}
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 z-10">

        {/* Generator-kort */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none z-0" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">3-Day Protocol</h2>
            <p className="text-sm text-gray-400 mb-6">
              {exercises.length === 0 && hasLoaded
                ? 'Opret øvelser under Indstillinger, så genererer vi dit program.'
                : 'Generér et nyt 3-dages program ud fra dine øvelser.'}
            </p>
            {exercises.length === 0 && hasLoaded ? (
              <Link href="/settings"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2">
                <Settings className="w-5 h-5" /> OPRET ØVELSER FØRST
              </Link>
            ) : (
              <button onClick={handleGenerate} disabled={isGenerating}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2">
                <RefreshCw className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'GENERERER...' : program ? 'GENERÉR NYT PROGRAM' : 'GENERÉR PROGRAM'}
              </button>
            )}
          </div>
        </div>

        {/* Ugeoversigt når program er genereret */}
        {program && (
          <div className="animate-in fade-in slide-in-from-bottom-4">

            {/* Ugestatus */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Denne uge</p>
              <p className="text-xs font-bold text-orange-400">{completedCount} / {allDays.length} fuldført</p>
            </div>

            {/* Fremskridtsbar */}
            <div className="h-1.5 bg-white/10 rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: allDays.length > 0 ? `${(completedCount / allDays.length) * 100}%` : '0%' }}
              />
            </div>

            <div className="flex flex-col gap-4">
              {program.map((day) => {
                const done = completedDays.includes(day.label);
                return (
                  <div key={day.label}
                    className={`backdrop-blur-xl rounded-3xl border overflow-hidden shadow-lg transition-all ${done ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}>

                    {/* Dag-header */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-3">
                      <div className="flex items-center gap-3">
                        {done
                          ? <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                          : <Circle className="w-6 h-6 text-gray-600 flex-shrink-0" />
                        }
                        <div>
                          <h3 className={`text-lg font-bold ${done ? 'text-green-300' : 'text-white'}`}>{day.label}</h3>
                          {done && <p className="text-xs text-green-500 font-semibold uppercase tracking-wider">Fuldført</p>}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-lg uppercase ${done ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {day.exercises.length} øvelser
                      </span>
                    </div>

                    {/* Øvelsesliste */}
                    <div className="px-6 pb-4 space-y-1.5">
                      {day.exercises.map((ex) => (
                        <div key={ex.id} className="flex items-center gap-2">
                          <span className={`text-xs ${done ? 'text-green-500' : 'text-orange-400'}`}>●</span>
                          <p className={`text-sm font-medium ${done ? 'text-green-200/70 line-through decoration-green-500/40' : 'text-white'}`}>{ex.name}</p>
                        </div>
                      ))}
                    </div>

                    {/* Start-knap — kun hvis ikke fuldført */}
                    <div className="px-6 pb-5">
                      {done ? (
                        <div className="w-full text-center text-green-400 text-sm font-bold py-3 rounded-2xl bg-green-500/10 border border-green-500/20">
                          ✓ Godt arbejde!
                        </div>
                      ) : (
                        <Link href={`/workout?dag=${encodeURIComponent(day.label)}`}
                          className="block text-center w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold py-4 rounded-2xl active:scale-95 transition-colors">
                          START {day.label.toUpperCase()}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hurtig start hvis intet program */}
        {!program && exercises.length > 0 && hasLoaded && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Hurtig start</h3>
              <span className="text-xs font-semibold bg-blue-500/20 px-3 py-1 rounded-lg text-blue-400 uppercase">{exercises.length} øvelser</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">Start træning med alle dine øvelser med det samme.</p>
            <Link href="/workout"
              className="block text-center w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold py-4 rounded-2xl active:scale-95 transition-colors">
              START TRÆNING
            </Link>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/10 pb-safe px-8 py-4 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <Link href="/" className="flex flex-col items-center text-orange-500">
            <CalendarDays className="w-6 h-6 mb-1" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Program</span>
          </Link>
          <Link href="/workout" className="flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity text-white">
            <div className="w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-full flex items-center justify-center -mt-6 transition-colors">
              <Dumbbell className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest mt-1">Træning</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity text-white">
            <Settings className="w-6 h-6 mb-1" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Indstillinger</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
