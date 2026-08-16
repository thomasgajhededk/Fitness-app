-- Migration: gåture, træningstype og de faktisk gennemførte øvelser
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
--
-- workout_type   'fullbody' | 'hoejintens' | 'walk'
-- distance_km    kun udfyldt på gåture
-- exercises      snapshot af de øvelser man rent faktisk kom igennem

alter table public.workout_sessions
  add column if not exists workout_type text,
  add column if not exists distance_km numeric,
  add column if not exists exercises jsonb;

-- Eksisterende sessioner er alle almindelige træninger.
update public.workout_sessions set workout_type = 'fullbody' where workout_type is null;
