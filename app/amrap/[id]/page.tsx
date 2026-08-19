'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { supabase } from '@/lib/supabase/client';
import { todayISO } from '@/lib/workout';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Play, Pause, Timer, Trophy, Repeat, Flag } from 'lucide-react';

type AmrapMove = { name: string; reps: number };
type Amrap     = { id: string; name: string; duration_minutes: number; exercises: AmrapMove[]; record_rounds: number | null };

function formatTime(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AmrapPage() {
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const params   = useParams<{ id: string }>();
  const dagLabel = useSearchParams().get('dag');

  const [user, setUser]         = useState<User | null>(null);
  const [amrap, setAmrap]       = useState<Amrap | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [state, setState]             = useState<'READY' | 'RUNNING' | 'FINISHED'>('READY');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPaused, setIsPaused]       = useState(false);
  const [rounds, setRounds]           = useState(0);
  const [isRecord, setIsRecord]       = useState(false);

  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [calories, setCalories]       = useState('');
  const [isSavingCalories, setIsSavingCalories] = useState(false);
  const [caloriesSaved, setCaloriesSaved]       = useState(false);

  const savedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const { data } = await supabase.from('amrap_workouts')
        .select('id, name, duration_minutes, exercises, record_rounds')
        .eq('id', params.id).maybeSingle();
      if (data) {
        setAmrap(data as Amrap);
        setSecondsLeft((data as Amrap).duration_minutes * 60);
      }
      setIsLoading(false);
    })();
  }, [params.id]);

  useEffect(() => { requestWakeLock(); return () => { releaseWakeLock(); }; }, [requestWakeLock, releaseWakeLock]);

  // Nedtælling — stopper af sig selv når tiden er gået
  useEffect(() => {
    if (state !== 'RUNNING' || isPaused) return;
    if (secondsLeft <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('FINISHED');
      return;
    }
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [state, isPaused, secondsLeft]);

  // Gemmer træningen og opdaterer rekorden hvis der blev slået en
  const saveSession = useCallback(async () => {
    if (!user || !amrap) return;
    const beatenRecord = rounds > 0 && (amrap.record_rounds == null || rounds > amrap.record_rounds);
    setIsRecord(beatenRecord);

    const { data } = await supabase.from('workout_sessions').insert({
      user_id: user.id,
      day_label: dagLabel || amrap.name,
      workout_type: 'amrap',
      completed_date: todayISO(),
      exercise_count: amrap.exercises.length,
      exercises: amrap.exercises.map((m, i) => ({ id: `${amrap.id}-${i}`, name: `${m.name} × ${m.reps}`, category: null })),
      amrap_id: amrap.id,
      amrap_name: amrap.name,
      amrap_rounds: rounds,
    }).select('id').single();
    if (data) setSessionId(data.id);

    if (beatenRecord) {
      await supabase.from('amrap_workouts')
        .update({ record_rounds: rounds, record_date: todayISO() })
        .eq('id', amrap.id);
    }
  }, [user, amrap, rounds, dagLabel]);

  useEffect(() => {
    if (state === 'FINISHED' && !savedRef.current) {
      savedRef.current = true;
      saveSession();
    }
  }, [state, saveSession]);

  async function handleSaveCalories() {
    if (!sessionId) return;
    const val = parseInt(calories, 10);
    if (isNaN(val) || val < 0) return;
    setIsSavingCalories(true);
    const { error } = await supabase.from('workout_sessions').update({ calories_burned: val }).eq('id', sessionId);
    setIsSavingCalories(false);
    if (!error) setCaloriesSaved(true);
  }

  if (isLoading) return (
    <div className="min-h-screen bg-transparent flex items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-white/10 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (!amrap) return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white w-full max-w-md mx-auto text-center">
      <Timer className="w-16 h-16 text-gray-600 mb-4" />
      <h2 className="text-2xl font-bold mb-2">AMRAP&apos;en findes ikke</h2>
      <p className="text-gray-400 mb-6">Den er måske slettet. Opret en ny under Indstillinger.</p>
      <Link href="/settings" className="bg-orange-500 text-white font-bold py-4 px-8 rounded-2xl">GÅ TIL INDSTILLINGER</Link>
    </div>
  );

  const totalSeconds = amrap.duration_minutes * 60;

  if (state === 'FINISHED') return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white w-full max-w-md mx-auto">
      <Trophy className={`w-24 h-24 mb-6 animate-bounce ${isRecord ? 'text-yellow-400' : 'text-orange-500'}`} />
      <h1 className="text-4xl font-bold tracking-tighter mb-2">TID!</h1>
      <p className="text-orange-400 font-bold mb-1">{dagLabel ? `${dagLabel} · ` : ''}{amrap.name}</p>

      <div className="text-center my-6">
        <p className="text-[80px] leading-none font-bold tracking-tighter text-orange-500">{rounds}</p>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
          {rounds === 1 ? 'runde gennemført' : 'runder gennemført'}
        </p>
      </div>

      {isRecord ? (
        <div className="w-full max-w-sm bg-yellow-500/10 border border-yellow-500/30 rounded-3xl p-4 mb-4 text-center">
          <p className="text-yellow-400 font-bold flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" /> NY REKORD!
          </p>
          <p className="text-xs text-yellow-200/70 mt-1">
            {amrap.record_rounds != null ? `Din gamle rekord var ${amrap.record_rounds} runder.` : 'Din første rekord på denne AMRAP.'}
          </p>
        </div>
      ) : amrap.record_rounds != null && (
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-4 mb-4 text-center">
          <p className="text-sm text-gray-400">Din rekord er <span className="text-orange-400 font-bold">{amrap.record_rounds} runder</span>.</p>
        </div>
      )}

      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-5 mb-4">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Forbrændte kalorier (valgfrit)</label>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" value={calories} onChange={e => { setCalories(e.target.value); setCaloriesSaved(false); }}
            placeholder="Fx. 320"
            className="flex-1 min-w-0 bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
          <button onClick={handleSaveCalories} disabled={isSavingCalories || !calories || caloriesSaved}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50">
            {isSavingCalories ? 'VENT' : caloriesSaved ? '✓ GEMT' : 'GEM'}
          </button>
        </div>
      </div>

      <Link href="/" className="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white text-center font-bold py-4 rounded-2xl active:scale-95 transition-colors shadow-lg shadow-orange-500/20">
        TILBAGE TIL FORSIDE
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent flex flex-col text-white w-full max-w-md mx-auto overflow-x-clip">
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <Link href="/" className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <p className="text-[10px] uppercase tracking-widest font-bold text-orange-400 text-center min-w-0 truncate px-2">
          {dagLabel ? `${dagLabel} · ` : ''}AMRAP · {amrap.duration_minutes} min
        </p>
        <div className="w-10" />
      </header>

      <main className="flex-1 flex flex-col p-6 gap-5 pb-28">

        {state === 'READY' ? (
          <>
            <div>
              <h1 className="text-4xl font-bold tracking-tighter">{amrap.name}</h1>
              <p className="text-sm text-gray-400 mt-2">
                Så mange runder som muligt på {amrap.duration_minutes} minutter. Tryk &quot;Ny runde&quot; hver gang du har lavet alle øvelser.
              </p>
            </div>

            {amrap.record_rounds != null && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-3xl p-4 flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-yellow-400 font-bold">Rekord: {amrap.record_rounds} runder</p>
                  <p className="text-xs text-yellow-200/70">Slå den i dag.</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Øvelser pr. runde</label>
              <div className="space-y-2">
                {amrap.exercises.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <span className="text-orange-500 font-bold text-sm w-5 flex-shrink-0">{i + 1}</span>
                    <p className="flex-1 min-w-0 font-bold text-sm break-words">{m.name}</p>
                    <span className="text-sm font-bold text-orange-400 flex-shrink-0">{m.reps} reps</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Nedtælling */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative flex items-center justify-center">
                <svg className="w-[260px] h-[260px] transform -rotate-90">
                  <circle cx="130" cy="130" r="120" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                  <circle cx="130" cy="130" r="120" stroke="currentColor" strokeWidth="4" fill="transparent"
                    strokeDasharray="754" strokeDashoffset={`${754 - (secondsLeft / totalSeconds) * 754}`}
                    className={`transition-all duration-1000 ease-linear ${secondsLeft <= 30 ? 'text-red-500' : 'text-orange-500'}`} />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className={`text-[64px] font-mono leading-none font-bold ${secondsLeft <= 30 ? 'text-red-500' : 'text-orange-500'}`}>
                    {formatTime(secondsLeft)}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-2">Tid tilbage</span>
                </div>
              </div>
            </div>

            {/* Runder */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex items-center justify-between shadow-lg">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Runder</p>
                <p className="text-4xl font-bold tracking-tighter">{rounds}</p>
              </div>
              {amrap.record_rounds != null && (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Rekord</p>
                  <p className={`text-lg font-bold ${rounds > amrap.record_rounds ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {amrap.record_rounds}
                  </p>
                </div>
              )}
            </div>

            {/* Øvelserne i runden */}
            <div className="space-y-2">
              {amrap.exercises.map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white/5 rounded-2xl px-4 py-2.5 border border-white/10">
                  <p className="text-sm font-bold break-words min-w-0">{m.name}</p>
                  <span className="text-sm font-bold text-orange-400 flex-shrink-0">{m.reps}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/60 backdrop-blur-md border-t border-white/10">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {state === 'READY' ? (
            <button onClick={() => setState('RUNNING')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-3">
              <Play className="fill-current w-6 h-6" /> <span className="text-xl tracking-wide">START</span>
            </button>
          ) : (
            <>
              <button onClick={() => setRounds(r => r + 1)} disabled={isPaused}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-8 rounded-3xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-3">
                <Repeat className="w-8 h-8 stroke-[3]" /> <span className="text-2xl tracking-wide">NY RUNDE</span>
              </button>
              <div className="flex gap-3">
                <button onClick={() => setIsPaused(p => !p)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-colors">
                  {isPaused ? <><Play className="w-4 h-4" /> FORTSÆT</> : <><Pause className="w-4 h-4" /> PAUSE</>}
                </button>
                <button onClick={() => setState('FINISHED')}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-colors">
                  <Flag className="w-4 h-4" /> AFSLUT
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
