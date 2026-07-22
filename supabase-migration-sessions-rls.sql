-- Migration: sikr workout_sessions med Row Level Security (RLS)
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
-- Formål: hver bruger kan KUN se og ændre sine egne træningssessioner.
-- Denne fil rydder op i tidligere politik-navne og laver ét rent sæt på 4 politikker.

alter table public.workout_sessions enable row level security;

-- Fjern eventuelle ældre/duplikerede politikker (uanset navn) så vi ender rent.
drop policy if exists "select_own_sessions" on public.workout_sessions;
drop policy if exists "insert_own_sessions" on public.workout_sessions;
drop policy if exists "update_own_sessions" on public.workout_sessions;
drop policy if exists "delete_own_sessions" on public.workout_sessions;
drop policy if exists "Users can view their own workout sessions." on public.workout_sessions;
drop policy if exists "Users can insert their own workout sessions." on public.workout_sessions;
drop policy if exists "Users can update their own workout sessions." on public.workout_sessions;
drop policy if exists "Users can delete their own workout sessions." on public.workout_sessions;

-- Ét rent sæt: én politik pr. handling, begrænset til den indloggede bruger.
create policy "Users can view their own workout sessions."
  on public.workout_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own workout sessions."
  on public.workout_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workout sessions."
  on public.workout_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own workout sessions."
  on public.workout_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);
