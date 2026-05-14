'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Dumbbell, Settings, CalendarDays, Activity, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Exercise = {
  id: string;
  name: string;
  category: string | null;
};

type ProgramDay = {
  label: string;
  exercises: Exercise[];
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildProgram(exercises: Exercise[]): ProgramDay[] {
  const shuffled = shuffle(exercises);
  const perDay = Math.ceil(shuffled.length / 3);
  return [
    { label: 'Dag 1', exercises: shuffled.slice(0, perDay) },
    { label: 'Dag 2', exercises: shuffled.slice(perDay, perDay * 2) },
    { label: 'Dag 3', exercises: shuffled.slice(perDay * 2) },
  ].filter((d) => d.exercises.length > 0);
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [program, setProgram] = useState<ProgramDay[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from('exercises')
          .select('id, name, category')
          .order('name');
        if (data) setExercises(data);
      }
      setHasLoaded(true);
    };
    init();
  }, []);

  const handleGenerate = () => {
    if (exercises.length === 0) return;
    setIsGenerating(true);
    setTimeout(() => {
      setProgram(buildProgram(exercises));
      setIsGenerating(false);
    }, 600);
  };

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="pb-24 pt-8 px-4 max-w-md mx-auto min-h-screen flex flex-col relative text-white">

      <header className="mb-8 flex items-center justify-between z-10">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tighter">JAAFIT <span className="text-orange-500">PRO</span></h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Build your physique</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-yellow-400 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20">
          {initials}
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 z-10">

        {/* Program-generator */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none z-0" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">3-Day Protocol</h2>
            <p className="text-sm text-gray-400 mb-6">
              {exercises.length === 0 && hasLoaded
                ? 'Du har ingen øvelser endnu. Gå til Indstillinger og opret dine øvelser, så genererer vi dit program.'
                : 'Generér et nyt 3-dages program ud fra dine øvelser.'}
            </p>

            {exercises.length === 0 && hasLoaded ? (
              <Link
                href="/settings"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                OPRET ØVELSER FØRST
              </Link>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'GENERERER...' : program ? 'GENERÉR NYT PROGRAM' : 'GENERÉR PROGRAM'}
              </button>
            )}
          </div>
        </div>

        {/* Genereret program */}
        {program && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            {program.map((day) => (
              <div key={day.label} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">{day.label}</h3>
                  <span className="text-xs font-semibold bg-orange-500/20 px-3 py-1 rounded-lg text-orange-400 uppercase">
                    {day.exercises.length} øvelser
                  </span>
                </div>
                <div className="space-y-2 mb-5">
                  {day.exercises.map((ex) => (
                    <div key={ex.id} className="flex items-center gap-3">
                      <span className="text-orange-400 text-xs">●</span>
                      <div>
                        <p className="text-sm font-medium">{ex.name}</p>
                        {ex.category && (
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider">{ex.category}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/workout"
                  className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold py-3 rounded-2xl active:scale-95 transition-colors text-sm"
                >
                  START DENNE DAG
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Hurtig start hvis intet program genereret endnu */}
        {!program && exercises.length > 0 && hasLoaded && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Hurtig start</h3>
              <span className="text-xs font-semibold bg-blue-500/20 px-3 py-1 rounded-lg text-blue-400 uppercase">
                {exercises.length} øvelser
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-6">Start træning med alle dine øvelser med det samme.</p>
            <Link
              href="/workout"
              className="block text-center w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold py-4 rounded-2xl active:scale-95 transition-colors"
            >
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
