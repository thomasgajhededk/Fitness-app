/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Play, Pause, Check, FastForward, Trophy, Dumbbell, X } from 'lucide-react';

type WorkoutState = 'EXERCISE_ACTIVE' | 'SET_REST' | 'TRANSITION' | 'FINISHED';

type Exercise = {
  id: string;
  name: string;
  category: string | null;
  recommended_reps: string | null;
  is_time_based: boolean | null;
  door_anchor_position: string | null;
  grip_type: string | null;
  selected_bands: string[];
  image_url: string | null;
  user_exercise_settings: { current_load: string | null }[];
};

type Band = { id: string; name: string };

const ANCHOR_LABEL: Record<string, string> = { top: 'Øverst', middle: 'Midden', bottom: 'Bunden' };
const GRIP_LABEL: Record<string, string>   = { stang: 'Stang', grib: 'Grib', ingen_grib: 'Uden grib', 'ankelbånd': 'Ankelbånd' };

function Tag({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${color}`}>{label}</span>;
}

export default function WorkoutPage() {
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const searchParams  = useSearchParams();
  const dagLabel      = searchParams.get('dag');

  const [user, setUser]                             = useState<User | null>(null);
  const [exercises, setExercises]                   = useState<Exercise[]>([]);
  const [userBands, setUserBands]                   = useState<Band[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [currentState, setCurrentState]             = useState<WorkoutState>('EXERCISE_ACTIVE');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet]                 = useState(1);
  const [timer, setTimer]                           = useState(0);
  const [isTimerRunning, setIsTimerRunning]         = useState(false);
  const [pendingBands, setPendingBands]             = useState<string[]>([]);
  const [isSavingBands, setIsSavingBands]           = useState(false);
  const [bandsSaved, setBandsSaved]                 = useState(false);

  const handleTimerFinishRef = useRef<() => void>(() => {});
  const sessionSavedRef      = useRef(false);

  const currentExercise = exercises[currentExerciseIndex] ?? null;
  const isLastExercise  = currentExerciseIndex === exercises.length - 1;
  const isLastSet       = currentSet === 3;
  const timeSecs        = currentExercise?.is_time_based
    ? parseInt(currentExercise.recommended_reps || '45', 10) || 45
    : 45;
  const currentLoad = currentExercise?.user_exercise_settings?.[0]?.current_load || null;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const [exRes, bandRes] = await Promise.all([
        supabase.from('exercises')
          .select('id, name, category, recommended_reps, is_time_based, door_anchor_position, grip_type, selected_bands, image_url, user_exercise_settings(current_load)')
          .order('category'),
        user
          ? supabase.from('user_bands').select('id, name').eq('user_id', user.id).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);
      if (!exRes.error && exRes.data) setExercises(exRes.data as Exercise[]);
      if (bandRes.data) setUserBands(bandRes.data as Band[]);
      setIsLoadingExercises(false);
    })();
  }, []);

  useEffect(() => { requestWakeLock(); return () => { releaseWakeLock(); }; }, [requestWakeLock, releaseWakeLock]);

  // Gem workout-session i databasen når dag er fuldført
  const saveSession = useCallback(async () => {
    if (!user || !dagLabel) return;
    await supabase.from('workout_sessions').insert({
      user_id: user.id,
      day_label: dagLabel,
      completed_date: new Date().toISOString().split('T')[0],
    });
  }, [user, dagLabel]);

  // Kald saveSession én gang når state bliver FINISHED
  useEffect(() => {
    if (currentState === 'FINISHED' && !sessionSavedRef.current) {
      sessionSavedRef.current = true;
      saveSession();
    }
  }, [currentState, saveSession]);

  // Sæt pendingBands når vi går i TRANSITION
  useEffect(() => {
    if (currentState === 'TRANSITION' && currentExercise) {
      setPendingBands(currentExercise.selected_bands ?? []);
      setBandsSaved(false);
    }
  }, [currentState, currentExercise]);

  const saveSetLog = useCallback(async (exerciseId: string, setNumber: number, durationSecs = 0) => {
    if (!user) return;
    await supabase.from('workout_logs').insert({
      user_id: user.id,
      exercise_id: exerciseId,
      sets_completed: setNumber,
      total_reps: 0,
      duration_seconds: durationSecs,
    });
  }, [user]);

  const handleTimerFinish = useCallback(() => {
    if (currentState === 'SET_REST') {
      setCurrentState('EXERCISE_ACTIVE');
      setCurrentSet(prev => prev + 1);
    } else if (currentState === 'TRANSITION') {
      if (!isLastExercise) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        setCurrentState('EXERCISE_ACTIVE');
      } else {
        setCurrentState('FINISHED');
      }
    } else if (currentState === 'EXERCISE_ACTIVE' && currentExercise?.is_time_based) {
      saveSetLog(currentExercise.id, currentSet, timeSecs).then(() => {
        if (isLastSet) { setCurrentState('TRANSITION'); setTimer(60); setIsTimerRunning(true); }
        else           { setCurrentState('SET_REST');   setTimer(60); setIsTimerRunning(true); }
      });
    }
  }, [currentState, isLastExercise, currentExercise, currentSet, isLastSet, timeSecs, saveSetLog]);

  useEffect(() => { handleTimerFinishRef.current = handleTimerFinish; }, [handleTimerFinish]);

  useEffect(() => {
    if (!isTimerRunning) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (timer <= 0) { setIsTimerRunning(false); handleTimerFinishRef.current(); return; }
    const id = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, timer]);

  const startTimer = (secs: number) => { setTimer(secs); setIsTimerRunning(true); };
  const handleSkip = () => { setIsTimerRunning(false); setTimer(0); handleTimerFinishRef.current(); };

  const handleLogSet = async () => {
    if (!currentExercise) return;
    await saveSetLog(currentExercise.id, currentSet, currentExercise.is_time_based ? timeSecs : 0);
    if (isLastSet) { setCurrentState('TRANSITION'); startTimer(60); }
    else           { setCurrentState('SET_REST');   startTimer(60); }
  };

  function togglePendingBand(name: string) {
    setPendingBands(prev => prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name]);
  }

  async function handleSaveBands() {
    if (!currentExercise) return;
    setIsSavingBands(true);
    const { error } = await supabase.from('exercises').update({ selected_bands: pendingBands }).eq('id', currentExercise.id);
    setIsSavingBands(false);
    if (!error) {
      setExercises(prev => prev.map(ex => ex.id === currentExercise.id ? { ...ex, selected_bands: pendingBands } : ex));
      setBandsSaved(true);
    }
  }

  if (isLoadingExercises) return (
    <div className="min-h-screen bg-transparent flex items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-white/10 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (exercises.length === 0) return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white max-w-md mx-auto text-center">
      <Dumbbell className="w-16 h-16 text-gray-600 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Ingen øvelser endnu</h2>
      <p className="text-gray-400 mb-6">Opret øvelser under Indstillinger for at starte træning.</p>
      <Link href="/settings" className="bg-orange-500 text-white font-bold py-4 px-8 rounded-2xl">GÅ TIL INDSTILLINGER</Link>
    </div>
  );

  if (currentState === 'FINISHED') return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white max-w-md mx-auto">
      <Trophy className="w-24 h-24 text-orange-500 mb-6 animate-bounce" />
      <h1 className="text-4xl font-bold tracking-tighter mb-2">FÆRDIG!</h1>
      {dagLabel && <p className="text-orange-400 font-bold mb-2">{dagLabel} fuldført</p>}
      <p className="text-gray-400 mb-8 text-center">Alle sæt er gemt. Godt arbejde.</p>
      <Link href="/" className="w-full max-w-sm bg-orange-500 hover:bg-orange-600 text-white text-center font-bold py-4 rounded-2xl active:scale-95 transition-colors shadow-lg shadow-orange-500/20">
        TILBAGE TIL FORSIDE
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative text-white max-w-md mx-auto">
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md z-10 relative">
        <Link href="/" className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold">
            {dagLabel ? `${dagLabel} · ` : ''}Øvelse {currentExerciseIndex + 1} / {exercises.length}
          </p>
          <div className="flex gap-1 mt-1 justify-center">
            {[1, 2, 3].map(n => (
              <div key={n} className={`w-8 h-1 rounded-full ${n <= currentSet ? 'bg-orange-500' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 flex flex-col relative z-10 overflow-y-auto">

        {/* ── EXERCISE ACTIVE ── */}
        {currentState === 'EXERCISE_ACTIVE' && currentExercise && (
          <div className="flex flex-col min-h-full">
            {currentExercise.image_url && (
              <div className="w-full flex-shrink-0" style={{ aspectRatio: '16/9' }}>
                <img src={currentExercise.image_url} alt={currentExercise.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 flex flex-col p-6">
              <div className="text-center mb-4">
                {currentExercise.category && (
                  <span className="inline-block px-3 py-1 bg-white/10 border border-white/10 text-orange-400 text-xs font-bold uppercase rounded-lg mb-3 tracking-wider">
                    {currentExercise.category}
                  </span>
                )}
                <h2 className="text-4xl font-bold leading-tight tracking-tighter">{currentExercise.name}</h2>
              </div>

              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-lg mb-4">
                {currentExercise.selected_bands?.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-white/10">
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">Elastikker</p>
                    <div className="flex flex-wrap gap-2">
                      {currentExercise.selected_bands.map((b, i) => (
                        <Tag key={i} label={b} color="bg-orange-500/20 border-orange-500/30 text-orange-300" />
                      ))}
                    </div>
                  </div>
                )}
                {currentExercise.door_anchor_position && (
                  <div className="mb-4 pb-4 border-b border-white/10">
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">Døranker</p>
                    <Tag label={ANCHOR_LABEL[currentExercise.door_anchor_position] ?? currentExercise.door_anchor_position} color="bg-blue-500/20 border-blue-500/30 text-blue-300" />
                  </div>
                )}
                {currentExercise.grip_type && (
                  <div className="mb-4 pb-4 border-b border-white/10">
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-2">Grib</p>
                    <Tag label={GRIP_LABEL[currentExercise.grip_type] ?? currentExercise.grip_type} color="bg-purple-500/20 border-purple-500/30 text-purple-300" />
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">Mål</p>
                    <p className="font-bold text-lg">
                      {currentExercise.is_time_based ? `${timeSecs} sek` : `${currentExercise.recommended_reps || '?'} reps`}
                    </p>
                  </div>
                  {currentLoad && (
                    <div className="text-right">
                      <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">Sidst brugt</p>
                      <p className="font-bold text-orange-400">{currentLoad}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-auto">
                {currentExercise.is_time_based ? (
                  <>
                    <button
                      onClick={() => isTimerRunning ? setIsTimerRunning(false) : startTimer(timeSecs)}
                      className={`w-full font-bold py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors active:scale-95 shadow-lg border border-white/10 ${isTimerRunning ? 'bg-red-500/80 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'}`}>
                      {isTimerRunning ? <Pause className="fill-current w-8 h-8" /> : <Play className="fill-current w-8 h-8" />}
                      <span className="text-xl tracking-wide">{isTimerRunning ? `TID: ${timer}s` : 'START TIMER'}</span>
                    </button>
                    {!isTimerRunning && timer > 0 && timer < timeSecs && (
                      <button onClick={handleLogSet} className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-colors">
                        <Check className="w-5 h-5 text-green-400" /> LOG SÆT ALLIGEVEL
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={handleLogSet} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors active:scale-95 shadow-lg shadow-orange-500/20">
                    <Check className="w-8 h-8 stroke-[3]" />
                    <span className="text-xl tracking-wide">LOG SÆT {currentSet}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SET REST ── */}
        {currentState === 'SET_REST' && (
          <div className="flex-col flex items-center justify-center p-6 animate-in zoom-in-95 duration-300" style={{ minHeight: 'calc(100vh - 73px)' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 bg-white/5 px-4 py-1 rounded-full border border-white/10">
              Pause inden sæt {currentSet + 1}
            </h3>
            <div className="text-[120px] font-mono leading-none font-bold text-orange-500 mb-12 relative flex items-center justify-center">
              <svg className="absolute w-[280px] h-[280px] transform -rotate-90">
                <circle cx="140" cy="140" r="130" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                <circle cx="140" cy="140" r="130" stroke="currentColor" strokeWidth="4" fill="transparent"
                  strokeDasharray="816" strokeDashoffset={`${816 - (timer / 60) * 816}`}
                  className="text-orange-500 transition-all duration-1000 ease-linear" />
              </svg>
              <span className="z-10">{timer}</span>
            </div>
            <button onClick={handleSkip} className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-colors">
              <FastForward className="w-6 h-6 text-gray-400" /> SKIP PAUSE
            </button>
          </div>
        )}

        {/* ── TRANSITION: Elastikskift ── */}
        {currentState === 'TRANSITION' && currentExercise && (
          <div className="flex flex-col p-6 animate-in slide-in-from-bottom-4 duration-300" style={{ minHeight: 'calc(100vh - 73px)' }}>

            <div className="flex items-center justify-between mb-6 pt-2">
              <div>
                <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest">
                  {isLastExercise ? 'Træning slut' : 'Næste øvelse'}
                </p>
                <p className="text-xl font-bold mt-0.5">
                  {!isLastExercise && exercises[currentExerciseIndex + 1]
                    ? exercises[currentExerciseIndex + 1].name
                    : 'Færdig!'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Start om</p>
                <p className="text-3xl font-mono font-bold text-orange-500">{timer}s</p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex-1">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="text-lg font-bold">Vil du skifte elastikker?</h3>
                  <p className="text-xs text-gray-400 mt-1">For <span className="text-orange-400 font-semibold">{currentExercise.name}</span></p>
                </div>
                {bandsSaved && (
                  <span className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-400/10 border border-green-400/20 px-2 py-1 rounded-full">
                    <Check className="w-3 h-3" /> Gemt
                  </span>
                )}
              </div>

              {userBands.length === 0 ? (
                <p className="text-gray-500 text-sm italic mt-4">Ingen elastikker — gå til Indstillinger → Udstyr.</p>
              ) : (
                <div className="mt-4">
                  {currentExercise.selected_bands?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Nuværende</p>
                      <div className="flex flex-wrap gap-2">
                        {currentExercise.selected_bands.map((b, i) => (
                          <span key={i} className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/10 text-gray-300">{b}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 mt-4">Vælg nye</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {userBands.map(b => {
                      const sel = pendingBands.includes(b.name);
                      return (
                        <button key={b.id} type="button" onClick={() => togglePendingBand(b.name)}
                          className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors active:scale-95 ${sel ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                          {b.name}
                        </button>
                      );
                    })}
                    {pendingBands.length > 0 && (
                      <button type="button" onClick={() => setPendingBands([])}
                        className="px-3 py-2 rounded-full text-xs font-bold border border-white/10 bg-white/5 text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1">
                        <X className="w-3 h-3" /> Ryd
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleSkip}
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold py-4 rounded-2xl transition-colors active:scale-95">
                      NEJ TAK
                    </button>
                    <button onClick={handleSaveBands} disabled={isSavingBands}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 transition-colors active:scale-95 disabled:opacity-50">
                      {isSavingBands ? 'GEMMER...' : bandsSaved ? '✓ GEMT' : 'GEM'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleSkip}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-colors">
              START NÆSTE NU
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
