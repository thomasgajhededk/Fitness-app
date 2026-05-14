'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type ProgramDay = { label: string; exercises: { id: string }[] };

function getMondayISO(): string {
  const d = new Date();
  const diff = (d.getDay() === 0 ? -6 : 1 - d.getDay());
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export default function WorkoutStartPage() {
  const router = useRouter();
  const [noProgram, setNoProgram] = useState(false);
  const [allDone, setAllDone]     = useState(false);

  useEffect(() => {
    (async () => {
      let program: ProgramDay[] | null = null;
      try {
        const saved = localStorage.getItem('jaafit_program');
        if (saved) program = JSON.parse(saved);
      } catch { /* ignore */ }

      if (!program || program.length === 0) { setNoProgram(true); return; }

      const { data: { user } } = await supabase.auth.getUser();
      let completedDays: string[] = [];
      if (user) {
        const { data } = await supabase
          .from('workout_sessions').select('day_label')
          .eq('user_id', user.id).gte('completed_date', getMondayISO());
        if (data) completedDays = data.map(r => r.day_label);
      }

      const nextDay = program.find(d => !completedDays.includes(d.label));
      if (!nextDay) { setAllDone(true); return; }

      const ids = nextDay.exercises.map(e => e.id).join(',');
      router.replace(`/workout?dag=${encodeURIComponent(nextDay.label)}&ids=${ids}`);
    })();
  }, [router]);

  if (noProgram) return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white text-center max-w-md mx-auto">
      <div className="text-6xl mb-6">📋</div>
      <h2 className="text-2xl font-bold mb-3">Intet program endnu</h2>
      <p className="text-gray-400 mb-8">Generér et 3-dages program på forsiden, og kom igang.</p>
      <button onClick={() => router.push('/')}
        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors">
        GÅ TIL FORSIDEN
      </button>
    </div>
  );

  if (allDone) return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white text-center max-w-md mx-auto">
      <div className="text-6xl mb-6">🏆</div>
      <h2 className="text-2xl font-bold mb-3">Alle dage fuldført!</h2>
      <p className="text-gray-400 mb-8">Du har klaret alle tre dage denne uge. Generér et nyt program for at fortsætte.</p>
      <button onClick={() => router.push('/')}
        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors">
        GENERÉR NYT PROGRAM
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-white/10 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Finder næste træning...</p>
      </div>
    </div>
  );
}
