'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Home, Activity, X, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type WeightLog  = { id: string; weight_kg: number; log_date: string };
type Exercise   = { id: string; name: string; category: string | null; door_anchor_position: string | null; grip_type: string | null; selected_bands: string[] };
type Band       = { id: string; name: string };

const CATEGORIES   = ['Bryst', 'Ryg', 'Skulder', 'Biceps', 'Triceps', 'Ben', 'Core', 'Cardio', 'Helkrop'];
const ANCHOR_OPTS  = [{ value: 'top',    label: 'Øverst'  },
                      { value: 'middle', label: 'Midden'  },
                      { value: 'bottom', label: 'Bunden'  }];
const GRIP_OPTS    = [{ value: 'stang',      label: 'Stang'      },
                      { value: 'grib',       label: 'Grib'       },
                      { value: 'ingen_grib', label: 'Uden grib'  },
                      { value: 'ankelbånd',  label: 'Ankelbånd'  }];

const EMPTY_FORM = {
  name: '', category: '', recommended_reps: '', is_time_based: false,
  use_door_anchor: false, door_anchor_position: 'top',
  use_grip: false, grip_type: 'grib',
  selected_bands: [] as string[],
};

export default function SettingsPage() {
  const [activeTab, setActiveTab]       = useState<'WEIGHT' | 'EXERCISES' | 'UDSTYR'>('WEIGHT');
  const [user, setUser]                 = useState<User | null>(null);

  // Vægt
  const [weightLogs, setWeightLogs]     = useState<WeightLog[]>([]);
  const [newWeight, setNewWeight]       = useState('');
  const [isLogging, setIsLogging]       = useState(false);
  const [weightError, setWeightError]   = useState<string | null>(null);

  // Øvelser
  const [exercises, setExercises]       = useState<Exercise[]>([]);
  const [isLoadingEx, setIsLoadingEx]   = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  // Elastikker
  const [bands, setBands]               = useState<Band[]>([]);
  const [newBandName, setNewBandName]   = useState('');
  const [isAddingBand, setIsAddingBand] = useState(false);
  const [isDeletingBandId, setIsDeletingBandId] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [isCreating, setIsCreating]     = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) await Promise.all([loadWeightLogs(user.id), loadExercises(), loadBands(user.id)]);
    })();
  }, []);

  async function loadWeightLogs(uid: string) {
    const { data } = await supabase.from('weight_logs').select('id, weight_kg, log_date')
      .eq('user_id', uid).order('log_date', { ascending: true });
    if (data) setWeightLogs(data);
  }

  async function loadExercises() {
    setIsLoadingEx(true);
    const { data } = await supabase.from('exercises')
      .select('id, name, category, door_anchor_position, grip_type, selected_bands').order('name');
    if (data) setExercises(data as Exercise[]);
    setIsLoadingEx(false);
  }

  async function loadBands(uid: string) {
    const { data } = await supabase.from('user_bands').select('id, name')
      .eq('user_id', uid).order('created_at', { ascending: true });
    if (data) setBands(data);
  }

  async function handleLogWeight() {
    const val = parseFloat(newWeight);
    if (!newWeight || isNaN(val) || !user) return;
    setIsLogging(true); setWeightError(null);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('weight_logs').insert({ user_id: user.id, weight_kg: val, log_date: today });
    setIsLogging(false);
    if (error) { setWeightError('Fejl: ' + error.message); return; }
    setNewWeight(''); await loadWeightLogs(user.id);
  }

  async function handleDeleteExercise(id: string) {
    setIsDeletingId(id); setDeleteError(null);
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) {
      setDeleteError(error.code === '23503' ? 'Kan ikke slettes — øvelsen er logget i en træning.' : 'Fejl: ' + error.message);
    } else {
      setExercises(prev => prev.filter(e => e.id !== id));
    }
    setIsDeletingId(null);
  }

  async function handleAddBand() {
    if (!newBandName.trim() || !user) return;
    setIsAddingBand(true);
    const { data, error } = await supabase.from('user_bands')
      .insert({ user_id: user.id, name: newBandName.trim() })
      .select('id, name').single();
    setIsAddingBand(false);
    if (!error && data) { setBands(prev => [...prev, data]); setNewBandName(''); }
  }

  async function handleDeleteBand(id: string) {
    setIsDeletingBandId(id);
    const { error } = await supabase.from('user_bands').delete().eq('id', id);
    if (!error) setBands(prev => prev.filter(b => b.id !== id));
    setIsDeletingBandId(null);
  }

  function toggleBand(name: string) {
    setForm(prev => ({
      ...prev,
      selected_bands: prev.selected_bands.includes(name)
        ? prev.selected_bands.filter(b => b !== name)
        : [...prev.selected_bands, name],
    }));
  }

  async function handleCreate() {
    if (!form.name.trim() || !user) return;
    setIsCreating(true); setCreateError(null);
    const { data, error } = await supabase.from('exercises').insert({
      name:                  form.name.trim(),
      category:              form.category || null,
      recommended_reps:      form.recommended_reps || null,
      is_time_based:         form.is_time_based,
      door_anchor_position:  form.use_door_anchor ? form.door_anchor_position : null,
      grip_type:             form.use_grip        ? form.grip_type            : null,
      selected_bands:        form.selected_bands,
      user_id:               user.id,
    })
    .select('id, name, category, door_anchor_position, grip_type, selected_bands')
    .single();
    setIsCreating(false);
    if (error) { setCreateError('Fejl: ' + error.message); return; }
    if (data) setExercises(prev => [...prev, data as Exercise].sort((a, b) => a.name.localeCompare(b.name, 'da')));
    setForm(EMPTY_FORM); setShowModal(false);
  }

  const chartData    = weightLogs.map(l => ({ date: new Date(l.log_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }), weight: l.weight_kg }));
  const latestWeight = weightLogs.length ? weightLogs[weightLogs.length - 1].weight_kg : '--';

  // Hjælpefunktion til at vise udstyr på en øvelse
  function equipmentSummary(ex: Exercise) {
    const parts: string[] = [];
    if (ex.selected_bands?.length) parts.push(ex.selected_bands.join(' + '));
    if (ex.door_anchor_position) parts.push('Døranker: ' + ANCHOR_OPTS.find(a => a.value === ex.door_anchor_position)?.label);
    if (ex.grip_type) parts.push(GRIP_OPTS.find(g => g.value === ex.grip_type)?.label ?? '');
    return parts.join(' · ') || 'Intet udstyr';
  }

  return (
    <div className="pb-24 min-h-screen bg-transparent flex flex-col relative text-white max-w-md mx-auto">

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setForm(EMPTY_FORM); setCreateError(null); } }}>
          <div className="w-full max-w-md bg-[#1c1b1b] border border-white/10 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tighter">Ny øvelse</h2>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setCreateError(null); }}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex flex-col gap-5">

              {/* Navn */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Navn *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Fx. Biceps curl" className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
              </div>

              {/* Kategori */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Kategori</label>
                <div className="relative">
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white appearance-none">
                    <option value="">Vælg kategori</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Reps / sekunder */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                  {form.is_time_based ? 'Sekunder pr. sæt' : 'Reps / Mål'}
                </label>
                <input type={form.is_time_based ? 'number' : 'text'} value={form.recommended_reps}
                  onChange={e => setForm({ ...form, recommended_reps: e.target.value })}
                  placeholder={form.is_time_based ? 'Fx. 45' : 'Fx. 10-12'}
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
              </div>

              {/* Tidsbaseret toggle */}
              <button type="button" onClick={() => setForm({ ...form, is_time_based: !form.is_time_based })}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${form.is_time_based ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                <span className="text-sm font-bold uppercase tracking-wider">Tidsbaseret øvelse</span>
                <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${form.is_time_based ? 'bg-orange-500 justify-end' : 'bg-white/10 justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </button>

              {/* ── UDSTYR ── */}
              <div className="border-t border-white/10 pt-5">
                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">Udstyr</p>

                {/* Elastikker */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Elastikker</label>
                  {bands.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">Ingen elastikker oprettet endnu. Gå til "Udstyr"-fanen.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {bands.map(b => {
                        const selected = form.selected_bands.includes(b.name);
                        return (
                          <button key={b.id} type="button" onClick={() => toggleBand(b.name)}
                            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                            {b.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Døranker */}
                <div className="mb-4">
                  <button type="button" onClick={() => setForm({ ...form, use_door_anchor: !form.use_door_anchor })}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl border transition-colors ${form.use_door_anchor ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                    <span className="text-sm font-bold uppercase tracking-wider">Døranker</span>
                    <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${form.use_door_anchor ? 'bg-blue-500 justify-end' : 'bg-white/10 justify-start'}`}>
                      <div className="w-4 h-4 rounded-full bg-white shadow" />
                    </div>
                  </button>
                  {form.use_door_anchor && (
                    <div className="flex gap-2 mt-2">
                      {ANCHOR_OPTS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setForm({ ...form, door_anchor_position: opt.value })}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${form.door_anchor_position === opt.value ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grib */}
                <div>
                  <button type="button" onClick={() => setForm({ ...form, use_grip: !form.use_grip })}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl border transition-colors ${form.use_grip ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                    <span className="text-sm font-bold uppercase tracking-wider">Grib</span>
                    <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${form.use_grip ? 'bg-purple-500 justify-end' : 'bg-white/10 justify-start'}`}>
                      <div className="w-4 h-4 rounded-full bg-white shadow" />
                    </div>
                  </button>
                  {form.use_grip && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {GRIP_OPTS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setForm({ ...form, grip_type: opt.value })}
                          className={`py-2 rounded-xl text-sm font-bold border transition-colors ${form.grip_type === opt.value ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {createError && <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">{createError}</p>}

              <button type="button" onClick={handleCreate} disabled={isCreating || !form.name.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50 active:scale-95">
                {isCreating ? 'OPRETTER...' : 'OPRET ØVELSE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tighter ml-2">Indstillinger</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-gray-400 hover:text-white uppercase tracking-widest font-bold">LOG UD</button>
      </header>

      {/* ── TABS ── */}
      <div className="flex p-4 gap-2">
        {(['WEIGHT', 'EXERCISES', 'UDSTYR'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-2xl font-bold tracking-wide text-[11px] transition-colors ${activeTab === tab ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>
            {tab === 'WEIGHT' ? 'VÆGT' : tab === 'EXERCISES' ? 'ØVELSER' : 'UDSTYR'}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4">

        {/* ── VÆGT ── */}
        {activeTab === 'WEIGHT' && (
          <div className="animate-in fade-in">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-6 shadow-lg">
              <h2 className="text-sm font-bold uppercase text-gray-400 mb-1">Nuværende Vægt</h2>
              <div className="text-4xl font-bold text-orange-500 mb-6">{latestWeight}<span className="text-xl text-gray-400">kg</span></div>
              <div className="flex gap-2">
                <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Ny vægt (kg)"
                  className="flex-1 bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white" />
                <button onClick={handleLogWeight} disabled={isLogging || !newWeight}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50">
                  {isLogging ? 'VENT' : 'LOG'}
                </button>
              </div>
              {weightError && <p className="text-red-400 text-sm mt-3 font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">{weightError}</p>}
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 h-[300px] shadow-lg">
              {weightLogs.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff' }} itemStyle={{ color: '#f97316', fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 italic text-sm">Ingen logs endnu.</div>
              )}
            </div>
          </div>
        )}

        {/* ── ØVELSER ── */}
        {activeTab === 'EXERCISES' && (
          <div className="animate-in fade-in">
            <button onClick={() => { setShowModal(true); setCreateError(null); }}
              className="w-full bg-white/5 border border-dashed border-white/20 hover:bg-white/10 text-orange-400 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 mb-4 transition-colors">
              <Plus className="w-5 h-5" /> OPRET NY ØVELSE
            </button>
            {deleteError && (
              <div className="flex items-start gap-3 text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20 mb-4">
                <span className="flex-1">{deleteError}</span>
                <button onClick={() => setDeleteError(null)}><X className="w-4 h-4" /></button>
              </div>
            )}
            {isLoadingEx ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : exercises.length === 0 ? (
              <p className="text-center text-gray-500 italic text-sm py-8">Ingen øvelser endnu.</p>
            ) : (
              <div className="space-y-3">
                {exercises.map(ex => (
                  <div key={ex.id} className="bg-white/5 backdrop-blur-xl p-5 rounded-3xl border border-white/10 flex items-start justify-between shadow-lg gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg">{ex.name}</p>
                      {ex.category && <p className="text-xs text-orange-400 uppercase font-semibold mt-1">{ex.category}</p>}
                      <p className="text-xs text-gray-500 mt-1 truncate">{equipmentSummary(ex)}</p>
                    </div>
                    <button onClick={() => handleDeleteExercise(ex.id)} disabled={isDeletingId === ex.id}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/5 rounded-full border border-white/10 disabled:opacity-50 flex-shrink-0">
                      {isDeletingId === ex.id
                        ? <div className="w-4 h-4 border-2 border-white/10 border-t-red-400 rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── UDSTYR ── */}
        {activeTab === 'UDSTYR' && (
          <div className="animate-in fade-in">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-4 shadow-lg">
              <h2 className="text-sm font-bold uppercase text-gray-400 mb-1">Dine elastikker</h2>
              <p className="text-xs text-gray-500 mb-4">Tilføj navnene på dine elastikker — fx farve eller modstandsniveau.</p>
              <div className="flex gap-2">
                <input type="text" value={newBandName} onChange={e => setNewBandName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddBand()}
                  placeholder="Fx. Rød, Sort, 30kg..."
                  className="flex-1 bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
                <button onClick={handleAddBand} disabled={isAddingBand || !newBandName.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50">
                  {isAddingBand ? '...' : <Plus className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {bands.length === 0 ? (
              <p className="text-center text-gray-500 italic text-sm py-8">Ingen elastikker endnu. Tilføj din første ovenfor.</p>
            ) : (
              <div className="space-y-2">
                {bands.map(b => (
                  <div key={b.id} className="bg-white/5 backdrop-blur-xl px-5 py-4 rounded-2xl border border-white/10 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <p className="font-bold">{b.name}</p>
                    </div>
                    <button onClick={() => handleDeleteBand(b.id)} disabled={isDeletingBandId === b.id}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/5 rounded-full border border-white/10 disabled:opacity-50">
                      {isDeletingBandId === b.id
                        ? <div className="w-4 h-4 border-2 border-white/10 border-t-red-400 rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/10 pb-safe px-8 py-4 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <Link href="/" className="flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity text-white">
            <Home className="w-6 h-6 mb-1" /><span className="text-[10px] uppercase font-bold tracking-widest">Hjem</span>
          </Link>
          <Link href="/workout" className="flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity text-white">
            <div className="w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full flex items-center justify-center -mt-6 transition-colors">
              <Activity className="w-6 h-6" />
            </div>
          </Link>
          <Link href="/settings" className="flex flex-col items-center text-orange-500">
            <ArrowLeft className="w-6 h-6 mb-1 rotate-180" /><span className="text-[10px] uppercase font-bold tracking-widest">Dig</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
