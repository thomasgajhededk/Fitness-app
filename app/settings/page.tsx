/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Home, Activity, X, ChevronDown, ImageIcon, Pencil, Weight, KeyRound, UserPlus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type WeightLog = { id: string; weight_kg: number; log_date: string };
type WorkoutSession = {
  id: string;
  day_label: string;
  workout_type: string | null;
  exercise_count: number | null;
  calories_burned: number | null;
  distance_km: number | null;
  completed_date: string;
  exercises: { id: string; name: string; category: string | null }[] | null;
};
type Exercise  = { id: string; name: string; category: string | null; recommended_reps: string | null; is_time_based: boolean; per_side: boolean; exercise_type: string | null; door_anchor_position: string | null; grip_type: string | null; image_url: string | null };
type Band      = { id: string; weight_kg: number };
type ExSetting = { bands: number[]; is_disabled: boolean; hiit_disabled: boolean };
type AdminUser = { id: string; display_name: string | null; email: string; is_admin: boolean; workout_count: number };

const CATEGORIES  = ['Bryst', 'Ryg', 'Skulder', 'Biceps', 'Triceps', 'Ben', 'Core', 'Cardio', 'Helkrop'];
const SESSION_TYPE_LABEL: Record<string, string> = { fullbody: 'Fullbody', hoejintens: 'Højintens', walk: 'Gåtur' };
const ANCHOR_OPTS = [{ value: 'top', label: 'Øverst' }, { value: 'middle', label: 'Midden' }, { value: 'bottom', label: 'Bunden' }];
const GRIP_OPTS   = [{ value: 'stang', label: 'Stang' }, { value: 'grib', label: 'Grib' }, { value: 'ingen_grib', label: 'Uden grib' }, { value: 'ankelbånd', label: 'Ankelbånd' }];
const EMPTY_FORM  = { name: '', category: '', recommended_reps: '', is_time_based: false, per_side: false, exercise_type: '' as '' | 'compound' | 'isolation', use_door_anchor: false, door_anchor_position: 'top', use_grip: false, grip_type: 'grib' };
const EX_COLS     = 'id, name, category, recommended_reps, is_time_based, per_side, exercise_type, door_anchor_position, grip_type, image_url';

type ModalMode = 'create' | 'edit';
type Tab = 'WEIGHT' | 'EXERCISES' | 'UDSTYR' | 'USERS';

export default function SettingsPage() {
  const [activeTab, setActiveTab]         = useState<Tab>('WEIGHT');
  const [user, setUser]                   = useState<User | null>(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [weightLogs, setWeightLogs]       = useState<WeightLog[]>([]);
  const [sessions, setSessions]           = useState<WorkoutSession[]>([]);
  const [newWeight, setNewWeight]         = useState('');
  const [isLogging, setIsLogging]         = useState(false);
  const [weightError, setWeightError]     = useState<string | null>(null);
  const [exercises, setExercises]         = useState<Exercise[]>([]);
  const [exSettings, setExSettings]       = useState<Record<string, ExSetting>>({});
  const [isLoadingEx, setIsLoadingEx]     = useState(true);
  const [isDeletingId, setIsDeletingId]   = useState<string | null>(null);
  const [deleteError, setDeleteError]     = useState<string | null>(null);
  const [bands, setBands]                 = useState<Band[]>([]);
  const [newBandWeight, setNewBandWeight] = useState('');
  const [isAddingBand, setIsAddingBand]   = useState(false);
  const [isDeletingBandId, setIsDeletingBandId] = useState<string | null>(null);

  // Øvelses-modal (kun admin)
  const [showModal, setShowModal]         = useState(false);
  const [modalMode, setModalMode]         = useState<ModalMode>('create');
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [isSaving, setIsSaving]           = useState(false);
  const [modalError, setModalError]       = useState<string | null>(null);

  // Vægt-modal (pr. bruger, pr. øvelse)
  const [bandsFor, setBandsFor]           = useState<Exercise | null>(null);
  const [draftBands, setDraftBands]       = useState<number[]>([]);
  const [isSavingBands, setIsSavingBands] = useState(false);

  // Brugeradministration
  const [adminUsers, setAdminUsers]       = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [newUser, setNewUser]             = useState({ name: '', email: '', password: '' });
  const [userBusy, setUserBusy]           = useState(false);
  const [userError, setUserError]         = useState<string | null>(null);
  const [userNotice, setUserNotice]       = useState<string | null>(null);
  const [pwFor, setPwFor]                 = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword]     = useState('');

  // Billede
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage]     = useState(false);
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      setIsAdmin(!!profile?.is_admin);
      await Promise.all([
        loadWeightLogs(user.id), loadExercises(), loadBands(user.id),
        loadSessions(user.id), loadExSettings(user.id),
      ]);
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'USERS' && isAdmin) loadAdminUsers();
  }, [activeTab, isAdmin]);

  async function loadWeightLogs(uid: string) {
    const { data } = await supabase.from('weight_logs').select('id, weight_kg, log_date').eq('user_id', uid).order('log_date', { ascending: true });
    if (data) setWeightLogs(data);
  }

  async function loadSessions(uid: string) {
    const { data } = await supabase.from('workout_sessions').select('id, day_label, workout_type, exercise_count, calories_burned, distance_km, completed_date, exercises').eq('user_id', uid).order('completed_date', { ascending: false });
    if (data) setSessions(data as WorkoutSession[]);
  }

  async function loadExercises() {
    setIsLoadingEx(true);
    const { data } = await supabase.from('exercises').select(EX_COLS).order('name');
    if (data) setExercises(data as Exercise[]);
    setIsLoadingEx(false);
  }

  async function loadExSettings(uid: string) {
    const { data } = await supabase.from('user_exercise_settings').select('exercise_id, bands, is_disabled, hiit_disabled').eq('user_id', uid);
    if (!data) return;
    setExSettings(Object.fromEntries(data.map(r => [r.exercise_id, { bands: r.bands ?? [], is_disabled: r.is_disabled, hiit_disabled: r.hiit_disabled }])));
  }

  async function loadBands(uid: string) {
    const { data } = await supabase.from('user_bands').select('id, weight_kg').eq('user_id', uid).order('weight_kg', { ascending: true });
    if (data) setBands(data as Band[]);
  }

  async function loadAdminUsers() {
    setIsLoadingUsers(true); setUserError(null);
    const res = await fetch('/api/admin/users');
    const body = await res.json();
    setIsLoadingUsers(false);
    if (!res.ok) { setUserError(body.error ?? 'Kunne ikke hente brugere'); return; }
    setAdminUsers(body.users);
  }

  function settingFor(id: string): ExSetting {
    return exSettings[id] ?? { bands: [], is_disabled: false, hiit_disabled: false };
  }

  async function saveExSetting(exerciseId: string, patch: Partial<ExSetting>) {
    if (!user) return;
    const next = { ...settingFor(exerciseId), ...patch };
    setExSettings(prev => ({ ...prev, [exerciseId]: next }));
    await supabase.from('user_exercise_settings')
      .upsert({ user_id: user.id, exercise_id: exerciseId, ...next }, { onConflict: 'user_id,exercise_id' });
  }

  function openCreateModal() {
    setModalMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null); setRemoveImage(false);
    setModalError(null);
    setShowModal(true);
  }

  function openEditModal(ex: Exercise) {
    setModalMode('edit');
    setEditingId(ex.id);
    setForm({
      name: ex.name,
      category: ex.category ?? '',
      recommended_reps: ex.recommended_reps ?? '',
      is_time_based: ex.is_time_based,
      per_side: ex.per_side ?? false,
      exercise_type: (ex.exercise_type ?? '') as '' | 'compound' | 'isolation',
      use_door_anchor: !!ex.door_anchor_position,
      door_anchor_position: ex.door_anchor_position ?? 'top',
      use_grip: !!ex.grip_type,
      grip_type: ex.grip_type ?? 'grib',
    });
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(ex.image_url);
    setRemoveImage(false);
    setModalError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null); setRemoveImage(false);
    setModalError(null);
    setEditingId(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file); setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Komprimerer billedet til JPEG med max 1920px bredde — sparer storage og hastighed
  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1920;
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas ikke understøttet')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Komprimering fejlede')),
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Billedet kunne ikke læses'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Filen kunne ikke læses'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(userId: string): Promise<string | null> {
    if (!imageFile) return null;
    try {
      const compressed = await compressImage(imageFile);
      const path = `${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('exercise-images')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
      if (error) {
        console.error('Upload fejl:', error.message);
        setModalError('Billede kunne ikke uploades: ' + error.message);
        return null;
      }
      const { data } = supabase.storage.from('exercise-images').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('Image processing fejl:', msg);
      setModalError('Kunne ikke behandle billede: ' + msg);
      return null;
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !user) return;
    setIsSaving(true); setModalError(null);

    let finalImageUrl: string | null = existingImageUrl;
    if (imageFile) {
      const uploaded = await uploadImage(user.id);
      if (uploaded) finalImageUrl = uploaded;
    }
    if (removeImage) finalImageUrl = null;

    const payload = {
      name:                 form.name.trim(),
      category:             form.category || null,
      recommended_reps:     form.recommended_reps || null,
      is_time_based:        form.is_time_based,
      per_side:             form.per_side,
      exercise_type:        form.exercise_type || null,
      door_anchor_position: form.use_door_anchor ? form.door_anchor_position : null,
      grip_type:            form.use_grip        ? form.grip_type            : null,
      image_url:            finalImageUrl,
    };

    if (modalMode === 'create') {
      // user_id forbliver null — øvelser er fælles for alle brugere
      const { data, error } = await supabase.from('exercises').insert(payload).select(EX_COLS).single();
      setIsSaving(false);
      if (error) { setModalError('Fejl: ' + error.message); return; }
      if (data) setExercises(prev => [...prev, data as Exercise].sort((a, b) => a.name.localeCompare(b.name, 'da')));
    } else {
      if (!editingId) return;
      const { data, error } = await supabase.from('exercises').update(payload).eq('id', editingId).select(EX_COLS).single();
      setIsSaving(false);
      if (error) { setModalError('Fejl: ' + error.message); return; }
      if (data) setExercises(prev => prev.map(ex => ex.id === editingId ? data as Exercise : ex));
    }

    closeModal();
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
    if (error) { setDeleteError(error.code === '23503' ? 'Kan ikke slettes — øvelsen er logget i en træning.' : 'Fejl: ' + error.message); }
    else { setExercises(prev => prev.filter(e => e.id !== id)); }
    setIsDeletingId(null);
  }

  async function handleAddBand() {
    const val = parseFloat(newBandWeight);
    if (!newBandWeight || isNaN(val) || val <= 0 || !user) return;
    setIsAddingBand(true);
    const { data, error } = await supabase.from('user_bands').insert({ user_id: user.id, weight_kg: val }).select('id, weight_kg').single();
    setIsAddingBand(false);
    if (!error && data) {
      setBands(prev => [...prev, data as Band].sort((a, b) => a.weight_kg - b.weight_kg));
      setNewBandWeight('');
    }
  }

  async function handleDeleteBand(id: string) {
    setIsDeletingBandId(id);
    const { error } = await supabase.from('user_bands').delete().eq('id', id);
    if (!error) setBands(prev => prev.filter(b => b.id !== id));
    setIsDeletingBandId(null);
  }

  function openBandsModal(ex: Exercise) {
    setBandsFor(ex);
    setDraftBands([...settingFor(ex.id).bands]);
  }

  async function saveBandsModal() {
    if (!bandsFor) return;
    setIsSavingBands(true);
    await saveExSetting(bandsFor.id, { bands: [...draftBands].sort((a, b) => a - b) });
    setIsSavingBands(false);
    setBandsFor(null);
  }

  async function handleCreateUser() {
    setUserBusy(true); setUserError(null); setUserNotice(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    const body = await res.json();
    setUserBusy(false);
    if (!res.ok) { setUserError(body.error ?? 'Kunne ikke oprette brugeren'); return; }
    setUserNotice(`${newUser.name} er oprettet.`);
    setNewUser({ name: '', email: '', password: '' });
    await loadAdminUsers();
  }

  async function handleChangePassword() {
    if (!pwFor) return;
    setUserBusy(true); setUserError(null); setUserNotice(null);
    const res = await fetch(`/api/admin/users/${pwFor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    const body = await res.json();
    setUserBusy(false);
    if (!res.ok) { setUserError(body.error ?? 'Kunne ikke skifte adgangskoden'); return; }
    setUserNotice(`Adgangskoden for ${pwFor.display_name ?? pwFor.email} er skiftet.`);
    setPwFor(null); setNewPassword('');
  }

  async function handleDeleteUser(u: AdminUser) {
    if (!confirm(`Slet ${u.display_name ?? u.email}? Alle deres træninger, vægt og elastikker slettes permanent.`)) return;
    setUserBusy(true); setUserError(null); setUserNotice(null);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    const body = await res.json();
    setUserBusy(false);
    if (!res.ok) { setUserError(body.error ?? 'Kunne ikke slette brugeren'); return; }
    setUserNotice(`${u.display_name ?? u.email} er slettet.`);
    await loadAdminUsers();
  }

  const chartData    = weightLogs.map(l => ({ date: new Date(l.log_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }), weight: l.weight_kg }));
  const latestWeight = weightLogs.length ? weightLogs[weightLogs.length - 1].weight_kg : '--';
  const tabs: Tab[]  = isAdmin ? ['WEIGHT', 'EXERCISES', 'UDSTYR', 'USERS'] : ['WEIGHT', 'EXERCISES', 'UDSTYR'];

  function equipmentSummary(ex: Exercise) {
    const parts: string[] = [];
    const mine = settingFor(ex.id).bands;
    if (mine.length) parts.push(`${mine.join(' + ')} = ${mine.reduce((a, b) => a + b, 0)} kg`);
    if (ex.door_anchor_position) parts.push('Døranker: ' + (ANCHOR_OPTS.find(a => a.value === ex.door_anchor_position)?.label ?? ''));
    if (ex.grip_type) parts.push(GRIP_OPTS.find(g => g.value === ex.grip_type)?.label ?? '');
    return parts.join(' · ') || 'Ingen vægt valgt';
  }

  // Hvor mange elastikker af hver vægt brugeren ejer — begrænser hvad der kan vælges
  const ownedCounts = bands.reduce<Record<number, number>>((acc, b) => {
    acc[b.weight_kg] = (acc[b.weight_kg] ?? 0) + 1;
    return acc;
  }, {});
  const distinctWeights = [...new Set(bands.map(b => b.weight_kg))].sort((a, b) => a - b);

  const currentImageSrc = imagePreview ?? (removeImage ? null : existingImageUrl);

  return (
    <div className="pb-24 min-h-screen bg-transparent flex flex-col relative text-white w-full max-w-md mx-auto overflow-x-clip">

      {/* ── ØVELSES-MODAL (kun admin) ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md bg-[#1c1b1b] border border-white/10 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tighter">
                {modalMode === 'create' ? 'Ny øvelse' : 'Rediger øvelse'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex flex-col gap-5">

              {/* Billede */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Topbillede (16:9)</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                {currentImageSrc ? (
                  <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <img src={currentImageSrc} alt="Preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-dashed border-white/20 hover:border-orange-500/50 bg-white/5 hover:bg-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-orange-400 transition-colors"
                    style={{ aspectRatio: '16/9' }}>
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs font-bold uppercase tracking-wider">Vælg billede</span>
                  </button>
                )}
              </div>

              {/* Navn */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Navn *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Fx. Biceps curl"
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
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

              {/* Reps */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{form.is_time_based ? 'Sekunder pr. sæt' : 'Reps / Mål'}</label>
                <input type={form.is_time_based ? 'number' : 'text'} value={form.recommended_reps}
                  onChange={e => setForm({ ...form, recommended_reps: e.target.value })}
                  placeholder={form.is_time_based ? 'Fx. 45' : 'Fx. 10-12'}
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
              </div>

              {/* Tidsbaseret */}
              <button type="button" onClick={() => setForm({ ...form, is_time_based: !form.is_time_based })}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${form.is_time_based ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                <span className="text-sm font-bold uppercase tracking-wider">Tidsbaseret øvelse</span>
                <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${form.is_time_based ? 'bg-orange-500 justify-end' : 'bg-white/10 justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </button>

              {/* Pr. side: to gennemløb pr. sæt — højre og venstre */}
              <button type="button" onClick={() => setForm({ ...form, per_side: !form.per_side })}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${form.per_side ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                <span className="text-left">
                  <span className="text-sm font-bold uppercase tracking-wider block">Trænes pr. side</span>
                  <span className="text-[11px] text-gray-500">Højre og venstre hver for sig i hvert sæt</span>
                </span>
                <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors flex-shrink-0 ${form.per_side ? 'bg-orange-500 justify-end' : 'bg-white/10 justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </button>

              {/* Type: compound / isolation */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['compound', 'Compound'], ['isolation', 'Isolation']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setForm({ ...form, exercise_type: form.exercise_type === val ? '' : val })}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${form.exercise_type === val ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">Compound = store øvelser (flere muskler). Bruges til korte pas (25 min).</p>
              </div>

              {/* ── Udstyr ── */}
              <div className="border-t border-white/10 pt-5">
                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">Udstyr</p>
                <p className="text-[11px] text-gray-500 mb-4">Vægten på elastikkerne sætter hver bruger selv under Øvelser.</p>

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

              {modalError && <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">{modalError}</p>}

              <button type="button" onClick={handleSave} disabled={isSaving || !form.name.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50 active:scale-95">
                {isSaving ? 'GEMMER...' : modalMode === 'create' ? 'OPRET ØVELSE' : 'GEM ÆNDRINGER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VÆGT-MODAL (pr. bruger) ── */}
      {bandsFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setBandsFor(null); }}>
          <div className="w-full max-w-md bg-[#1c1b1b] border border-white/10 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-1 gap-3">
              <h2 className="text-xl font-bold tracking-tighter min-w-0 break-words">{bandsFor.name}</h2>
              <button onClick={() => setBandsFor(null)} className="p-2 rounded-full hover:bg-white/10 text-gray-400 flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-6">Vælg de elastikker du bruger til øvelsen. Kun dine egne indstillinger ændres.</p>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Valgt</p>
              {draftBands.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Ingen — øvelsen laves uden elastik.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {draftBands.map((w, i) => (
                      <button key={i} type="button" onClick={() => setDraftBands(prev => prev.filter((_, j) => j !== i))}
                        className="px-3 py-2 rounded-full text-sm font-bold bg-orange-500 text-white flex items-center gap-2 active:scale-95 transition-transform">
                        {w} kg <X className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm font-bold text-orange-400">I alt {draftBands.reduce((a, b) => a + b, 0)} kg</p>
                </>
              )}
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tilføj</p>
            {distinctWeights.length === 0 ? (
              <p className="text-gray-500 text-sm italic mb-5">Du har ingen elastikker — tilføj dem under Udstyr.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-6">
                {distinctWeights.map(w => {
                  const used = draftBands.filter(x => x === w).length;
                  const left = (ownedCounts[w] ?? 0) - used;
                  return (
                    <button key={w} type="button" disabled={left <= 0}
                      onClick={() => setDraftBands(prev => [...prev, w])}
                      className="px-4 py-2 rounded-full text-sm font-bold border bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 transition-colors active:scale-95">
                      + {w} kg <span className="text-gray-500 text-[11px]">({left})</span>
                    </button>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={saveBandsModal} disabled={isSavingBands}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50 active:scale-95">
              {isSavingBands ? 'GEMMER...' : 'GEM'}
            </button>
          </div>
        </div>
      )}

      {/* ── ADGANGSKODE-MODAL ── */}
      {pwFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setPwFor(null); setNewPassword(''); } }}>
          <div className="w-full max-w-md bg-[#1c1b1b] border border-white/10 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between mb-1 gap-3">
              <h2 className="text-xl font-bold tracking-tighter min-w-0 break-words">Ny adgangskode</h2>
              <button onClick={() => { setPwFor(null); setNewPassword(''); }} className="p-2 rounded-full hover:bg-white/10 text-gray-400 flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-6 break-words">{pwFor.display_name ?? pwFor.email}</p>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Mindst 8 tegn" autoComplete="off"
              className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500 mb-4" />
            <button type="button" onClick={handleChangePassword} disabled={userBusy || newPassword.length < 8}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50 active:scale-95">
              {userBusy ? 'GEMMER...' : 'SKIFT ADGANGSKODE'}
            </button>
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
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-2xl font-bold tracking-wide text-[11px] transition-colors ${activeTab === tab ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>
            {tab === 'WEIGHT' ? 'VÆGT' : tab === 'EXERCISES' ? 'ØVELSER' : tab === 'UDSTYR' ? 'UDSTYR' : 'BRUGERE'}
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
                  className="flex-1 min-w-0 bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white" />
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

            {/* Gennemførte træninger */}
            <div className="mt-6">
              <h2 className="text-sm font-bold uppercase text-gray-400 mb-3 px-1">Gennemførte træninger</h2>
              {sessions.length === 0 ? (
                <p className="text-center text-gray-500 italic text-sm py-6">Ingen træninger endnu.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold break-words">{s.day_label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(s.completed_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {s.workout_type && ` · ${SESSION_TYPE_LABEL[s.workout_type] ?? s.workout_type}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {s.distance_km != null && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-300 whitespace-nowrap">{s.distance_km} km</span>
                          )}
                          {s.exercise_count != null && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-300 whitespace-nowrap">{s.exercise_count} øvelser</span>
                          )}
                          {s.calories_burned != null && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 whitespace-nowrap">{s.calories_burned} kcal</span>
                          )}
                        </div>
                      </div>
                      {!!s.exercises?.length && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                          {s.exercises.map((ex, i) => (
                            <div key={`${ex.id}-${i}`} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">●</span>
                              <p className="text-sm text-gray-300 break-words">{ex.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ØVELSER ── */}
        {activeTab === 'EXERCISES' && (
          <div className="animate-in fade-in">
            {isAdmin && (
              <button onClick={openCreateModal}
                className="w-full bg-white/5 border border-dashed border-white/20 hover:bg-white/10 text-orange-400 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 mb-4 transition-colors">
                <Plus className="w-5 h-5" /> OPRET NY ØVELSE
              </button>
            )}
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
                {exercises.map(ex => {
                  const setting = settingFor(ex.id);
                  return (
                    <div key={ex.id} className={`bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-lg transition-opacity ${setting.is_disabled ? 'opacity-45' : ''}`}>
                      {ex.image_url && (
                        <div className="w-full" style={{ aspectRatio: '16/9' }}>
                          <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-5 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-lg break-words">{ex.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
                            {ex.category && <p className="text-xs text-orange-400 uppercase font-semibold">{ex.category}</p>}
                            {ex.exercise_type
                              ? <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-300">{ex.exercise_type === 'compound' ? 'Compound' : 'Isolation'}</span>
                              : isAdmin && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">Type mangler</span>}
                            {setting.is_disabled && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">Fravalgt</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 break-words">{equipmentSummary(ex)}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {/* Min vægt */}
                          <button onClick={() => openBandsModal(ex)} title="Vælg dine elastikker"
                            className="p-2 text-gray-400 hover:text-orange-400 transition-colors bg-white/5 rounded-full border border-white/10">
                            <Weight className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => openEditModal(ex)} title="Rediger øvelse"
                                className="p-2 text-gray-400 hover:text-orange-400 transition-colors bg-white/5 rounded-full border border-white/10">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteExercise(ex.id)} disabled={isDeletingId === ex.id} title="Slet øvelse"
                                className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/5 rounded-full border border-white/10 disabled:opacity-50">
                                {isDeletingId === ex.id ? <div className="w-4 h-4 border-2 border-white/10 border-t-red-400 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Med i mine træninger */}
                      <button onClick={() => saveExSetting(ex.id, { is_disabled: !setting.is_disabled })}
                        className="w-full flex items-center justify-between px-5 py-3 border-t border-white/10 hover:bg-white/5 transition-colors">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Med i mine træninger</span>
                        <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors flex-shrink-0 ${setting.is_disabled ? 'bg-white/10 justify-start' : 'bg-orange-500 justify-end'}`}>
                          <div className="w-4 h-4 rounded-full bg-white shadow" />
                        </div>
                      </button>

                      {/* Med i højintens */}
                      <button onClick={() => saveExSetting(ex.id, { hiit_disabled: !setting.hiit_disabled })}
                        className="w-full flex items-center justify-between px-5 py-3 border-t border-white/10 hover:bg-white/5 transition-colors">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Med i højintens</span>
                        <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors flex-shrink-0 ${setting.hiit_disabled ? 'bg-white/10 justify-start' : 'bg-red-500 justify-end'}`}>
                          <div className="w-4 h-4 rounded-full bg-white shadow" />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── UDSTYR ── */}
        {activeTab === 'UDSTYR' && (
          <div className="animate-in fade-in">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-4 shadow-lg">
              <h2 className="text-sm font-bold uppercase text-gray-400 mb-1">Dine elastikker</h2>
              <p className="text-xs text-gray-500 mb-4">Skriv modstanden i kilo. Har du to ens, tilføjer du den bare to gange.</p>
              <div className="flex gap-2">
                <input type="number" step="0.5" min="0" inputMode="decimal" value={newBandWeight}
                  onChange={e => setNewBandWeight(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddBand()}
                  placeholder="Fx. 25"
                  className="flex-1 min-w-0 bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
                <button onClick={handleAddBand} disabled={isAddingBand || !newBandWeight.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 transition-colors disabled:opacity-50">
                  {isAddingBand ? '...' : <Plus className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {bands.length === 0 ? (
              <p className="text-center text-gray-500 italic text-sm py-8">Ingen elastikker endnu.</p>
            ) : (
              <div className="space-y-2">
                {bands.map(b => (
                  <div key={b.id} className="bg-white/5 backdrop-blur-xl px-5 py-4 rounded-2xl border border-white/10 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <p className="font-bold">{b.weight_kg} kg</p>
                    </div>
                    <button onClick={() => handleDeleteBand(b.id)} disabled={isDeletingBandId === b.id}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/5 rounded-full border border-white/10 disabled:opacity-50">
                      {isDeletingBandId === b.id ? <div className="w-4 h-4 border-2 border-white/10 border-t-red-400 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BRUGERE (kun admin) ── */}
        {activeTab === 'USERS' && isAdmin && (
          <div className="animate-in fade-in">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-4 shadow-lg">
              <h2 className="text-sm font-bold uppercase text-gray-400 mb-1">Opret bruger</h2>
              <p className="text-xs text-gray-500 mb-4">De får alle øvelser og elastikkerne 5, 10, 15, 20 og 25 kg fra start.</p>
              <div className="flex flex-col gap-2">
                <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Navn"
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
                <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="E-mail" autoComplete="off"
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
                <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Adgangskode (min. 8 tegn)" autoComplete="off"
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 border border-white/10 focus:outline-none focus:border-orange-500 text-white placeholder-gray-500" />
                <button onClick={handleCreateUser}
                  disabled={userBusy || !newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 active:scale-95">
                  <UserPlus className="w-5 h-5" /> {userBusy ? 'ARBEJDER...' : 'OPRET BRUGER'}
                </button>
              </div>
            </div>

            {userError && (
              <div className="flex items-start gap-3 text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20 mb-4">
                <span className="flex-1 break-words">{userError}</span>
                <button onClick={() => setUserError(null)}><X className="w-4 h-4" /></button>
              </div>
            )}
            {userNotice && (
              <div className="flex items-start gap-3 text-green-400 text-sm font-medium bg-green-400/10 p-3 rounded-xl border border-green-400/20 mb-4">
                <span className="flex-1 break-words">{userNotice}</span>
                <button onClick={() => setUserNotice(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            {isLoadingUsers ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {adminUsers.map(u => (
                  <div key={u.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold break-words">
                        {u.display_name ?? '—'}
                        {u.is_admin && <span className="ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300">Admin</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 break-all">{u.email}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{u.workout_count} gennemførte træninger</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setPwFor(u); setNewPassword(''); }} title="Skift adgangskode"
                        className="p-2 text-gray-400 hover:text-orange-400 transition-colors bg-white/5 rounded-full border border-white/10">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {u.id !== user?.id && (
                        <button onClick={() => handleDeleteUser(u)} disabled={userBusy} title="Slet bruger"
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors bg-white/5 rounded-full border border-white/10 disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
          <Link href="/workout/start" className="flex flex-col items-center opacity-40 hover:opacity-100 transition-opacity text-white">
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
