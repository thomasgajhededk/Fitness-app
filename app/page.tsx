'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Dumbbell, Settings, CalendarDays, RefreshCw, CheckCircle2, Circle, Zap, ChevronRight, RotateCcw, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Exercise   = { id: string; name: string; category: string | null; exercise_type: string | null; selected_bands: string[]; door_anchor_position: string | null; grip_type: string | null };
type Band       = { id: string; name: string };
type ProgramDay = { label: string; exercises: Exercise[] };

const GRIP_OPTS = [
  { value: 'stang',      label: 'Stang'     },
  { value: 'grib',       label: 'Grib'      },
  { value: 'ingen_grib', label: 'Uden grib' },
  { value: 'ankelbånd',  label: 'Ankelbånd' },
];

const CATEGORY_ORDER = ['Bryst', 'Ryg', 'Skulder', 'Biceps', 'Triceps', 'Ben', 'Core', 'Cardio', 'Helkrop'];

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

function buildProgram(exercises: Exercise[]): ProgramDay[] {
  const s = shuffle(exercises);
  const n = Math.ceil(s.length / 3);
  return [
    { label: 'Dag 1', exercises: s.slice(0, n) },
    { label: 'Dag 2', exercises: s.slice(n, n * 2) },
    { label: 'Dag 3', exercises: s.slice(n * 2) },
  ].filter(d => d.exercises.length > 0);
}

function getMondayISO(): string {
  const d = new Date();
  const diff = (d.getDay() === 0 ? -6 : 1 - d.getDay());
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function filterByEquipment(
  exercises: Exercise[],
  availBands: string[],
  hasDoorAnchor: boolean,
  availGrips: string[]
): Exercise[] {
  return exercises.filter(ex => {
    // Elastikker: alle øvelsens bands skal være tilgængelige (eller øvelsen har ingen)
    if (ex.selected_bands?.length > 0) {
      const hasAllBands = ex.selected_bands.every(b => availBands.includes(b));
      if (!hasAllBands) return false;
    }
    // Døranker: øvelse kræver det, men brugeren har det ikke
    if (ex.door_anchor_position && !hasDoorAnchor) return false;
    // Grib: øvelse kræver et bestemt grib, men brugeren har det ikke
    if (ex.grip_type && !availGrips.includes(ex.grip_type)) return false;
    return true;
  });
}

export default function HomePage() {
  const [user, setUser]                 = useState<User | null>(null);
  const [exercises, setExercises]       = useState<Exercise[]>([]);
  const [userBands, setUserBands]       = useState<Band[]>([]);
  const [program, setProgram]           = useState<ProgramDay[] | null>(() => {
    if (typeof window === 'undefined') return null;
    try { const s = localStorage.getItem('jaafit_program'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasLoaded, setHasLoaded]       = useState(false);
  const [completedDays, setCompletedDays] = useState<string[]>([]);

  // Hurtig træning
  const [showQuick, setShowQuick]       = useState(false);
  const [availBands, setAvailBands]     = useState<string[]>([]);
  const [hasDoorAnchor, setHasDoorAnchor] = useState(false);
  const [availGrips, setAvailGrips]     = useState<string[]>([]);
  const [quickBudget, setQuickBudget]   = useState<25 | 45>(45);
  const [excludedQuickCats, setExcludedQuickCats] = useState<string[]>([]);
  const [quickPool, setQuickPool]       = useState<Exercise[]>([]);
  const [quickExercises, setQuickExercises] = useState<Exercise[] | null>(null);

  const loadCompletedDays = useCallback(async (uid: string) => {
    const { data } = await supabase.from('workout_sessions').select('day_label').eq('user_id', uid).gte('completed_date', getMondayISO());
    if (data) setCompletedDays(data.map(r => r.day_label));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const [exRes, bandRes] = await Promise.all([
          supabase.from('exercises').select('id, name, category, exercise_type, selected_bands, door_anchor_position, grip_type').order('name'),
          supabase.from('user_bands').select('id, name').eq('user_id', user.id).order('created_at', { ascending: true }),
          loadCompletedDays(user.id),
        ]);
        if (exRes.data) setExercises(exRes.data as Exercise[]);
        if (bandRes.data) setUserBands(bandRes.data as Band[]);
      }
      setHasLoaded(true);
    })();
  }, [loadCompletedDays]);

  useEffect(() => {
    const onFocus = () => { if (user) loadCompletedDays(user.id); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, loadCompletedDays]);

  function handleGenerate() {
    if (!exercises.length) return;
    setIsGenerating(true);
    setTimeout(() => {
      const p = buildProgram(exercises);
      setProgram(p);
      localStorage.setItem('jaafit_program', JSON.stringify(p));
      setIsGenerating(false);
    }, 600);
  }

  function generateQuick() {
    const filtered = filterByEquipment(exercises, availBands, hasDoorAnchor, availGrips)
      .filter(ex => !ex.category || !excludedQuickCats.includes(ex.category));
    const target   = quickBudget === 45 ? 9 : 5;
    const s        = shuffle(filtered);
    // Ved 25 min: tag compound-øvelser først, ellers helt tilfældigt
    const ordered  = quickBudget === 25
      ? [...s.filter(e => e.exercise_type === 'compound'), ...s.filter(e => e.exercise_type !== 'compound')]
      : s;
    setQuickExercises(ordered.slice(0, target));
    setQuickPool(filtered);
  }

  function toggleBand(name: string) {
    setAvailBands(prev => prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name]);
    setQuickExercises(null);
  }
  function toggleGrip(val: string) {
    setAvailGrips(prev => prev.includes(val) ? prev.filter(g => g !== val) : [...prev, val]);
    setQuickExercises(null);
  }
  function toggleQuickCat(cat: string) {
    setExcludedQuickCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    setQuickExercises(null);
  }

  const quickEquipFiltered = filterByEquipment(exercises, availBands, hasDoorAnchor, availGrips);
  const quickCats = CATEGORY_ORDER.filter(c => quickEquipFiltered.some(e => e.category === c));

  const initials     = user?.email ? user.email.slice(0, 2).toUpperCase() : '??';
  const allDays      = program ?? [];
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

        {/* ── 3-DAY GENERATOR ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none z-0" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">3-Day Protocol</h2>
            <p className="text-sm text-gray-400 mb-6">
              {!exercises.length && hasLoaded
                ? 'Opret øvelser under Indstillinger, så genererer vi dit program.'
                : 'Generér et nyt 3-dages program ud fra dine øvelser.'}
            </p>
            {!exercises.length && hasLoaded ? (
              <Link href="/settings" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2">
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

        {/* ── HURTIG TRÆNING KNAP ── */}
        {exercises.length > 0 && (
          <button onClick={() => { setShowQuick(true); setQuickExercises(null); }}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg">
            {showQuick ? <X className="w-5 h-5 text-gray-400" /> : <Zap className="w-5 h-5 text-yellow-400" />}
            {showQuick ? 'LUK HURTIG TRÆNING' : 'LAV EN HURTIG TRÆNING'}
          </button>
        )}

        {/* ── HURTIG TRÆNING PANEL ── */}
        {showQuick && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-lg animate-in slide-in-from-bottom-4">

            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" /> Hurtig træning
                  </h3>
                  <p className="text-sm text-gray-400">Vælg hvad du har til rådighed — vi finder 9 øvelser.</p>
                </div>
                <button onClick={() => { setShowQuick(false); setQuickExercises(null); }}
                  className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-5">

              {/* Tid */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Tid</label>
                <div className="grid grid-cols-2 gap-2">
                  {([25, 45] as const).map(b => {
                    const sel = quickBudget === b;
                    return (
                      <button key={b} type="button" onClick={() => { setQuickBudget(b); setQuickExercises(null); }}
                        className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${sel ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                        {b === 25 ? '25 min (kort)' : '45 min (fuld)'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Elastikker */}
              {userBands.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Elastikker</label>
                  <div className="flex flex-wrap gap-2">
                    {userBands.map(b => {
                      const sel = availBands.includes(b.name);
                      return (
                        <button key={b.id} type="button" onClick={() => toggleBand(b.name)}
                          className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${sel ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Døranker */}
              <button type="button" onClick={() => { setHasDoorAnchor(p => !p); setQuickExercises(null); }}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${hasDoorAnchor ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                <span className="text-sm font-bold uppercase tracking-wider">Døranker</span>
                <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${hasDoorAnchor ? 'bg-blue-500 justify-end' : 'bg-white/10 justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </button>

              {/* Grib */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Grib</label>
                <div className="grid grid-cols-2 gap-2">
                  {GRIP_OPTS.map(g => {
                    const sel = availGrips.includes(g.value);
                    return (
                      <button key={g.value} type="button" onClick={() => toggleGrip(g.value)}
                        className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${sel ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Muskelgrupper */}
              {quickCats.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Muskelgrupper</label>
                  <div className="flex flex-wrap gap-2">
                    {quickCats.map(c => {
                      const sel = !excludedQuickCats.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleQuickCat(c)}
                          className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${sel ? 'bg-green-500 border-green-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generér-knap */}
              {!quickExercises && (
                <button onClick={generateQuick}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl shadow-lg shadow-yellow-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" /> FIND {quickBudget === 45 ? 9 : 5} ØVELSER
                </button>
              )}
            </div>

            {/* ── Resultat ── */}
            {quickExercises !== null && (
              <div className="border-t border-white/10">
                {quickExercises.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-gray-400 mb-4">Ingen øvelser matcher det valgte udstyr.<br/>Prøv at vælge mere udstyr.</p>
                    <button onClick={generateQuick} className="text-orange-400 font-bold text-sm uppercase tracking-wider">Prøv igen</button>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-gray-300 uppercase tracking-wider">{quickExercises.length} øvelser valgt</p>
                      <button onClick={generateQuick} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white font-bold uppercase tracking-wider transition-colors">
                        <RotateCcw className="w-3 h-3" /> Lav ny
                      </button>
                    </div>

                    <div className="space-y-2 mb-6">
                      {quickExercises.map((ex, i) => (
                        <div key={ex.id} className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                          <span className="text-orange-500 font-bold text-sm w-5 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{ex.name}</p>
                            {ex.category && <p className="text-[11px] text-gray-500 uppercase">{ex.category}</p>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button onClick={generateQuick}
                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold py-4 rounded-2xl transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Lav ny
                      </button>
                      <Link
                        href={`/workout?ids=${quickExercises.map(e => e.id).join(',')}&pool=${quickPool.map(e => e.id).join(',')}&budget=${quickBudget}`}
                        className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-colors flex items-center justify-center gap-2">
                        <Zap className="w-5 h-5" /> START
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── UGEOVERSIGT ── */}
        {program && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Denne uge</p>
              <p className="text-xs font-bold text-orange-400">{completedCount} / {allDays.length} fuldført</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full mb-5 overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: allDays.length > 0 ? `${(completedCount / allDays.length) * 100}%` : '0%' }} />
            </div>
            <div className="flex flex-col gap-4">
              {program.map((day) => {
                const done = completedDays.includes(day.label);
                return (
                  <div key={day.label}
                    className={`backdrop-blur-xl rounded-3xl border overflow-hidden shadow-lg transition-all ${done ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center justify-between px-6 pt-5 pb-3">
                      <div className="flex items-center gap-3">
                        {done
                          ? <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                          : <Circle className="w-6 h-6 text-gray-600 flex-shrink-0" />}
                        <div>
                          <h3 className={`text-lg font-bold ${done ? 'text-green-300' : 'text-white'}`}>{day.label}</h3>
                          {done && <p className="text-xs text-green-500 font-semibold uppercase tracking-wider">Fuldført</p>}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-lg uppercase ${done ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {day.exercises.length} øvelser
                      </span>
                    </div>
                    <div className="px-6 pb-4 space-y-1.5">
                      {day.exercises.map(ex => (
                        <div key={ex.id} className="flex items-center gap-2">
                          <span className={`text-xs ${done ? 'text-green-500' : 'text-orange-400'}`}>●</span>
                          <p className={`text-sm font-medium ${done ? 'text-green-200/70 line-through decoration-green-500/40' : 'text-white'}`}>{ex.name}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-6 pb-5">
                      {done ? (
                        <div className="w-full text-center text-green-400 text-sm font-bold py-3 rounded-2xl bg-green-500/10 border border-green-500/20">
                          ✓ Godt arbejde!
                        </div>
                      ) : (
                        <Link href={`/workout?dag=${encodeURIComponent(day.label)}&ids=${day.exercises.map(e => e.id).join(',')}`}
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
        {!program && !showQuick && exercises.length > 0 && hasLoaded && (
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
          <Link href="/workout/start" className="flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity text-white">
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
