-- ============================================================
-- JAAFIT — Flerbruger + admin
-- Kør hele filen i Supabase Dashboard → SQL Editor.
-- Sikker at køre flere gange.
--
-- !! VIGTIGT !! Ret e-mailen i afsnit 1 til den du logger ind med,
-- hvis den ikke er korrekt. Det er den bruger der bliver admin.
-- ============================================================


-- ------------------------------------------------------------
-- 1. PROFILER OG ADMIN-ROLLE
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

do $$
declare
  admin_email constant text := 'thomasgajhede88@gmail.com';   -- <<< RET HER
  admin_id    uuid;
begin
  select id into admin_id from auth.users where lower(email) = lower(admin_email);
  if admin_id is null then
    raise exception 'Ingen bruger med e-mailen %. Ret admin_email i afsnit 1.', admin_email;
  end if;
  update public.profiles set is_admin = true where id = admin_id;
end $$;

-- security definer gør at funktionen kan læse profiles uden at udløse
-- RLS-rekursion, når politikkerne herunder kalder den.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles_update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ------------------------------------------------------------
-- 2. ØVELSER BLIVER GLOBALE — kun admin kan redigere
-- ------------------------------------------------------------
update public.exercises set user_id = null where user_id is not null;

drop policy if exists "read_global_and_own_exercises" on public.exercises;
drop policy if exists "insert_own_exercises"          on public.exercises;
drop policy if exists "update_own_exercises"          on public.exercises;
drop policy if exists "delete_own_exercises"          on public.exercises;
drop policy if exists "exercises_select_all"          on public.exercises;
drop policy if exists "exercises_admin_insert"        on public.exercises;
drop policy if exists "exercises_admin_update"        on public.exercises;
drop policy if exists "exercises_admin_delete"        on public.exercises;

create policy "exercises_select_all" on public.exercises for select to authenticated
  using (true);

create policy "exercises_admin_insert" on public.exercises for insert to authenticated
  with check (public.is_admin());

create policy "exercises_admin_update" on public.exercises for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "exercises_admin_delete" on public.exercises for delete to authenticated
  using (public.is_admin());


-- ------------------------------------------------------------
-- 3. ELASTIKKER BLIVER TAL
--    "25 KG" → 25, så man kan eje flere af samme slags.
-- ------------------------------------------------------------
alter table public.user_bands add column if not exists weight_kg numeric;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'user_bands' and column_name = 'name') then

    update public.user_bands
      set weight_kg = nullif(regexp_replace(name, '[^0-9.]', '', 'g'), '')::numeric
      where weight_kg is null;

    if exists (select 1 from public.user_bands where weight_kg is null) then
      raise exception 'Kunne ikke udlede et tal fra alle elastik-navne — tjek user_bands.';
    end if;

    alter table public.user_bands drop column name;
  end if;
end $$;

alter table public.user_bands alter column weight_kg set not null;

alter table public.user_bands enable row level security;
drop policy if exists "user_bands_all" on public.user_bands;
create policy "user_bands_all" on public.user_bands for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- ------------------------------------------------------------
-- 4. ELASTIK-VALG OG TIL/FRA BLIVER PR. BRUGER
-- ------------------------------------------------------------
alter table public.user_exercise_settings
  add column if not exists bands       numeric[] not null default '{}',
  add column if not exists is_disabled boolean   not null default false;

-- Flyt admins nuværende valg fra exercises.selected_bands over på hans egen profil
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'exercises' and column_name = 'selected_bands') then

    insert into public.user_exercise_settings (user_id, exercise_id, bands)
    select p.id, e.id, b.weights
    from public.exercises e
    cross join (select id from public.profiles where is_admin) p
    cross join lateral (
      select array_agg(t.w order by t.w) as weights
      from (
        select nullif(regexp_replace(v, '[^0-9.]', '', 'g'), '')::numeric as w
        from jsonb_array_elements_text(e.selected_bands::jsonb) v
      ) t
    ) b
    where b.weights is not null
    on conflict (user_id, exercise_id) do update set bands = excluded.bands;

    alter table public.exercises drop column selected_bands;
  end if;
end $$;


-- ------------------------------------------------------------
-- 5. TRÆNINGSPROGRAMMER FLYTTER FRA BROWSEREN TIL DATABASEN
-- ------------------------------------------------------------
create table if not exists public.user_programs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  program    jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_programs enable row level security;

drop policy if exists "user_programs_all" on public.user_programs;
create policy "user_programs_all" on public.user_programs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- ------------------------------------------------------------
-- 6. SLETTES EN BRUGER, SLETTES ALT DERES DATA
-- ------------------------------------------------------------

-- 6a. Sørg for at alle bruger-tabeller overhovedet HAR en nøgle til auth.users
do $$
declare t text;
begin
  foreach t in array array['workout_logs', 'workout_sessions', 'user_exercise_settings',
                           'weight_logs', 'user_bands', 'user_programs']
  loop
    if to_regclass('public.' || t) is null then continue; end if;

    if not exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public' and tc.table_name = t
        and kcu.column_name = 'user_id'
    ) then
      execute format('delete from public.%I x where not exists '
                  || '(select 1 from auth.users u where u.id = x.user_id)', t);
      execute format('alter table public.%I add constraint %I foreign key (user_id) '
                  || 'references auth.users(id) on delete cascade', t, t || '_user_id_fkey');
    end if;
  end loop;
end $$;

-- 6b. Sæt "slet med" på alle nøgler der peger på en bruger eller en øvelse
do $$
declare r record;
begin
  for r in
    select tc.table_name, tc.constraint_name, kcu.column_name,
           ccu.table_schema as ref_schema, ccu.table_name as ref_table
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema    = 'public'
      and ((kcu.column_name = 'user_id'     and ccu.table_schema = 'auth'   and ccu.table_name = 'users')
        or (kcu.column_name = 'exercise_id' and ccu.table_schema = 'public' and ccu.table_name = 'exercises'))
  loop
    execute format('alter table public.%I drop constraint %I', r.table_name, r.constraint_name);
    execute format('alter table public.%I add constraint %I foreign key (%I) references %I.%I(id) '
                || 'on delete cascade',
                r.table_name, r.constraint_name, r.column_name, r.ref_schema, r.ref_table);
  end loop;
end $$;


-- ------------------------------------------------------------
-- 7. NYE BRUGERE FÅR AUTOMATISK PROFIL OG 5/10/15/20/25 KG
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_bands (user_id, weight_kg)
  select new.id, w from unnest(array[5, 10, 15, 20, 25]::numeric[]) w;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 8. INDEKSER
-- ------------------------------------------------------------
create index if not exists idx_user_bands_user_id       on public.user_bands(user_id);
create index if not exists idx_workout_sessions_user_id on public.workout_sessions(user_id);


-- ============================================================
-- FÆRDIG ✓
--
-- Gør derefter dette manuelt i Supabase Dashboard:
--   Authentication → Sign In / Providers → Email
--     → slå "Allow new users to sign up" FRA,
--       så kun admin kan oprette brugere.
-- ============================================================
