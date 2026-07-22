-- Migration: tilføj compound/isolation-markering til øvelser
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
-- Nullable uden default → eksisterende øvelser beholder null (= "ikke markeret endnu").

alter table public.exercises
  add column if not exists exercise_type text; -- 'compound' | 'isolation' | null
