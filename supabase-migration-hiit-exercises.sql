-- Migration: vælg selv hvilke øvelser der må bruges i højintens træning
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
--
-- hiit_disabled  true = øvelsen springes over når højintens trækker sine 4 øvelser.
-- Standard er false, så alle øvelser er med indtil man selv fravælger dem.

alter table public.user_exercise_settings
  add column if not exists hiit_disabled boolean not null default false;
