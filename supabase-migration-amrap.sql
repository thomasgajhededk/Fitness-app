-- Migration: AMRAP-træninger (As Many Rounds As Possible)
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
--
-- amrap_workouts   de AMRAP'er man selv opretter under Indstillinger.
--   exercises      [{ "name": "Burpees", "reps": 10 }, ...]
--   record_rounds  flest runder man har nået på denne AMRAP.
--
-- På workout_sessions gemmes hvilken AMRAP der blev kørt og hvor mange runder,
-- så en AMRAP taget som dagens træning kan vises i ugeoversigten.

create table if not exists public.amrap_workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  duration_minutes integer not null default 12,
  exercises        jsonb not null default '[]'::jsonb,
  record_rounds    integer,
  record_date      date,
  created_at       timestamptz not null default now()
);

create index if not exists amrap_workouts_user_id_idx on public.amrap_workouts(user_id);

alter table public.amrap_workouts enable row level security;

drop policy if exists "Users can view their own amrap workouts."   on public.amrap_workouts;
drop policy if exists "Users can insert their own amrap workouts." on public.amrap_workouts;
drop policy if exists "Users can update their own amrap workouts." on public.amrap_workouts;
drop policy if exists "Users can delete their own amrap workouts." on public.amrap_workouts;

create policy "Users can view their own amrap workouts."
  on public.amrap_workouts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own amrap workouts."
  on public.amrap_workouts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own amrap workouts."
  on public.amrap_workouts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own amrap workouts."
  on public.amrap_workouts for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.workout_sessions
  add column if not exists amrap_id     uuid references public.amrap_workouts(id) on delete set null,
  add column if not exists amrap_name   text,
  add column if not exists amrap_rounds integer;
