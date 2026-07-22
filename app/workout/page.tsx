/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Play, Pause, Check, FastForward, Trophy, Dumbbell, X } from 'lucide-react';

type WorkoutState = 'SETUP' | 'EXERCISE_ACTIVE' | 'SET_REST' | 'TRANSITION' | 'FINISHED';

type Exercise = {
  id: string;
  name: string;
  category: string | null;
  recommended_reps: string | null;
  is_time_based: boolean | null;
  exercise_type: string | null;
  door_anchor_position: string | null;
  grip_type: string | null;
  selected_bands: string[];
  image_url: string | null;
  user_exercise_settings: { current_load: string | null }[];
};

type Band = { id: string; name: string };

const ANCHOR_LABEL: Record<string, string> = { top: 'Øverst', middle: 'Midden', bottom: 'Bunden' };
const GRIP_LABEL: Record<string, string>   = { stang: 'Stang', grib: 'Grib', ingen_grib: 'Uden grib', 'ankelbånd': 'Ankelbånd' };
const CATEGORY_ORDER = ['Bryst', 'Ryg', 'Skulder', 'Biceps', 'Triceps', 'Ben', 'Core', 'Cardio', 'Helkrop'];

// Bygger den endelige træningsliste ud fra fravalgte muskelgrupper og tidsbudget.
// 25 min = kort: compound-øvelser først, fyld op med resten til ~5 øvelser. 45 min = alle.
function buildWorkout(all: Exercise[], excludedCategories: string[], timeBudget: 25 | 45): Exercise[] {
  const filtered = all.filter(ex => !ex.category || !excludedCategories.includes(ex.category));
  if (timeBudget === 45) return filtered;
  const targetCount = Math.max(3, Math.round(filtered.length * 25 / 45));
  const compounds = filtered.filter(ex => ex.exercise_type === 'compound');
  const rest      = filtered.filter(ex => ex.exercise_type !== 'compound');
  return [...compounds, ...rest].slice(0, targetCount);
}

function Tag({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${color}`}>{label}</span>;
}

export default function WorkoutPage() {
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const searchParams  = useSearchParams();
  const dagLabel      = searchParams.get('dag');
  const idsParam      = searchParams.get('ids');

  const [user, setUser]                             = useState<User | null>(null);
  const [allExercises, setAllExercises]             = useState<Exercise[]>([]);
  const [exercises, setExercises]                   = useState<Exercise[]>([]);
  const [userBands, setUserBands]                   = useState<Band[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [currentState, setCurrentState]             = useState<WorkoutState>('SETUP');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet]                 = useState(1);
  const [timer, setTimer]                           = useState(0);
  const [isTimerRunning, setIsTimerRunning]         = useState(false);
  const [pendingBands, setPendingBands]             = useState<string[]>([]);
  const [isSavingBands, setIsSavingBands]           = useState(false);
  const [bandsSaved, setBandsSaved]                 = useState(false);

  // Opsætning (tid + muskelgrupper)
  const [timeBudget, setTimeBudget]                 = useState<25 | 45>(45);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  // Valgt varighed for tidsbaserede øvelser (30 / 60 / 120 sek)
  const [chosenTimeSecs, setChosenTimeSecs]         = useState(45);

  const handleTimerFinishRef = useRef<() => void>(() => {});
  const sessionSavedRef      = useRef(false);

  const currentExercise = exercises[currentExerciseIndex] ?? null;
  const isLastExercise  = currentExerciseIndex === exercises.length - 1;
  const isLastSet       = currentSet === 3;
  const currentLoad = currentExercise?.user_exercise_settings?.[0]?.current_load || null;

  // Muskelgrupper til stede i denne træning (sorteret efter fast rækkefølge)
  const availableCategories = CATEGORY_ORDER.filter(c => allExercises.some(ex => ex.category === c));
  const previewCount = buildWorkout(allExercises, excludedCategories, timeBudget).length;

  // Nulstil valgt varighed når vi skifter til en ny øvelse
  useEffect(() => {
    if (!currentExercise?.is_time_based) return;
    const secs = parseInt(currentExercise.recommended_reps || '45', 10) || 45;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChosenTimeSecs(secs);
  }, [currentExercise]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const [exRes, bandRes] = await Promise.all([
        supabase.from('exercises')
          .select('id, name, category, recommended_reps, is_time_based, exercise_type, door_anchor_position, grip_type, selected_bands, image_url, user_exercise_settings(current_load)')
          .order('category'),
        user
          ? supabase.from('user_bands').select('id, name').eq('user_id', user.id).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);
      if (!exRes.error && exRes.data) {
        const allEx = exRes.data as Exercise[];
        if (idsParam) {
          const ids = idsParam.split(',');
          const ordered = ids.map(id => allEx.find(e => e.id === id)).filter(Boolean) as Exercise[];
          setAllExercises(ordered);
        } else {
          setAllExercises(allEx);
        }
      }
      if (bandRes.data) setUserBands(bandRes.data as Band[]);
      setIsLoadingExercises(false);
    })();
  }, [idsParam]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      saveSetLog(currentExercise.id, currentSet, chosenTimeSecs).then(() => {
        if (isLastSet) { setCurrentState('TRANSITION'); setTimer(60); setIsTimerRunning(true); }
        else           { setCurrentState('SET_REST');   setTimer(60); setIsTimerRunning(true); }
      });
    }
  }, [currentState, isLastExercise, currentExercise, currentSet, isLastSet, chosenTimeSecs, saveSetLog]);

  useEffect(() => { handleTimerFinishRef.current = handleTimerFinish; }, [handleTimerFinish]);

  useEffect(() => {
    if (!isTimerRunning) return;
    if (timer <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTimerRunning(false);
      handleTimerFinishRef.current();
      return;
    }
    const id = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, timer]);

  const startTimer = (secs: number) => { setTimer(secs); setIsTimerRunning(true); };
  const handleSkip = () => { setIsTimerRunning(false); setTimer(0); handleTimerFinishRef.current(); };

  const handleLogSet = async () => {
    if (!currentExercise) return;
    await saveSetLog(currentExercise.id, currentSet, currentExercise.is_time_based ? chosenTimeSecs : 0);
    if (isLastSet) { setCurrentState('TRANSITION'); startTimer(60); }
    else           { setCurrentState('SET_REST');   startTimer(60); }
  };

  // Spring hele øvelsen over → gå direkte til næste (eller afslut)
  const handleSkipExercise = () => {
    setIsTimerRunning(false);
    setTimer(0);
    if (!isLastExercise) {
      setCurrentExerciseIndex(prev => prev + 1);
      setCurrentSet(1);
      setCurrentState('EXERCISE_ACTIVE');
    } else {
      setCurrentState('FINISHED');
    }
  };

  // Start træningen ud fra opsætningen (tid + muskelgrupper)
  const handleStartWorkout = () => {
    const list = buildWorkout(allExercises, excludedCategories, timeBudget);
    if (list.length === 0) return;
    setExercises(list);
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setCurrentState('EXERCISE_ACTIVE');
  };

  function toggleCategory(cat: string) {
    setExcludedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

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

  if (allExercises.length === 0) return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-white max-w-md mx-auto text-center">
      <Dumbbell className="w-16 h-16 text-gray-600 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Ingen øvelser endnu</h2>
      <p className="text-gray-400 mb-6">Opret øvelser under Indstillinger for at starte træning.</p>
      <Link href="/settings" className="bg-orange-500 text-white font-bold py-4 px-8 rounded-2xl">GÅ TIL INDSTILLINGER</Link>
    </div>
  );

  if (currentState === 'SETUP') return (
    <div className="min-h-screen bg-transparent flex flex-col text-white max-w-md mx-auto">
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <Link href="/" className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold">
          {dagLabel ? `${dagLabel} · ` : ''}Tilpas træning
        </p>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-28">

        {/* Tidsbudget */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Hvor lang tid har du?</label>
          <div className="grid grid-cols-2 gap-3">
            {([[25, '25 min', 'Kort — de vigtigste øvelser'], [45, '45 min', 'Fuld — alle øvelser']] as const).map(([val, title, sub]) => (
              <button key={val} type="button" onClick={() => setTimeBudget(val)}
                className={`flex flex-col items-start gap-1 p-4 rounded-2xl border text-left transition-colors ${timeBudget === val ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                <span className="text-lg font-bold">{title}</span>
                <span className={`text-[11px] ${timeBudget === val ? 'text-white/80' : 'text-gray-500'}`}>{sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Muskelgrupper */}
        {availableCategories.length > 0 && (
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Muskelgrupper</label>
            <p className="text-xs text-gray-500 mb-3">Tryk for at fravælge grupper du vil springe over i dag.</p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(cat => {
                const active = !excludedCategories.includes(cat);
                const count  = allExercises.filter(ex => ex.category === cat).length;
                return (
                  <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors active:scale-95 ${active ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-500 line-through'}`}>
                    {cat} <span className={active ? 'text-white/70' : 'text-gray-600'}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Forhåndsvisning */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          {previewCount === 0
            ? <p className="text-red-400 font-bold text-sm">Ingen øvelser tilbage — vælg mindst én muskelgruppe.</p>
            : <p className="text-gray-300 text-sm"><span className="text-orange-400 font-bold text-lg">{previewCount}</span> øvelser i denne træning</p>}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/60 backdrop-blur-md border-t border-white/10">
        <div className="max-w-md mx-auto">
          <button onClick={handleStartWorkout} disabled={previewCount === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors disabled:opacity-40">
            START TRÆNING
          </button>
        </div>
      </div>
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
                      {currentExercise.is_time_based ? `${chosenTimeSecs} sek` : `${currentExercise.recommended_reps || '?'} reps`}
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
                    {!isTimerRunning && (
                      <div className="grid grid-cols-3 gap-2">
                        {([[30, '30 sek'], [60, '1 min'], [120, '2 min']] as const).map(([secs, label]) => (
                          <button key={secs} type="button" onClick={() => setChosenTimeSecs(secs)}
                            className={`py-3 rounded-xl text-sm font-bold border transition-colors active:scale-95 ${chosenTimeSecs === secs ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => isTimerRunning ? setIsTimerRunning(false) : startTimer(chosenTimeSecs)}
                      className={`w-full font-bold py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors active:scale-95 shadow-lg border border-white/10 ${isTimerRunning ? 'bg-red-500/80 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'}`}>
                      {isTimerRunning ? <Pause className="fill-current w-8 h-8" /> : <Play className="fill-current w-8 h-8" />}
                      <span className="text-xl tracking-wide">{isTimerRunning ? `TID: ${timer}s` : 'START TIMER'}</span>
                    </button>
                    {!isTimerRunning && timer > 0 && timer < chosenTimeSecs && (
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
                {!isTimerRunning && (
                  <button onClick={handleSkipExercise} className="w-full text-gray-400 hover:text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors">
                    <FastForward className="w-5 h-5" /> SPRING ØVELSE OVER
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
