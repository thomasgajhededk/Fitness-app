-- Supabase SQL Schema for JAAFIT

-- 1. Enable RLS
create extension if not exists "uuid-ossp";

-- 2. Exercises Table
create table public.exercises (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  category text, -- fx Bryst, Ben, Finisher
  equipment_type text, -- fx Bar, Handles, Bands, Bodyweight
  recommended_reps text, -- fx "6-15"
  is_time_based boolean default false,
  exercise_type text, -- 'compound' | 'isolation' | null (bruges til tidsbudget)
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.exercises enable row level security;

create policy "Exercises are viewable by everyone." 
  on exercises for select using (true);
create policy "Exercises are insertable by authenticated users." 
  on exercises for insert to authenticated with check (true);
create policy "Exercises are updatable by authenticated users." 
  on exercises for update to authenticated using (true);
create policy "Exercises are deletable by authenticated users." 
  on exercises for delete to authenticated using (true);

-- 3. Workout Logs Table
create table public.workout_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  exercise_id uuid references public.exercises not null,
  sets_completed integer default 0,
  total_reps integer default 0,
  duration_seconds integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.workout_logs enable row level security;

create policy "Users can view their own workout logs." 
  on workout_logs for select using (auth.uid() = user_id);
create policy "Users can insert their own workout logs." 
  on workout_logs for insert with check (auth.uid() = user_id);
create policy "Users can update their own workout logs." 
  on workout_logs for update using (auth.uid() = user_id);
create policy "Users can delete their own workout logs." 
  on workout_logs for delete using (auth.uid() = user_id);

-- 4. User Exercise Settings Table
create table public.user_exercise_settings (
  user_id uuid references auth.users not null,
  exercise_id uuid references public.exercises not null,
  current_load text, -- fx "Black + Yellow band" eller "Bodyweight"
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, exercise_id)
);
alter table public.user_exercise_settings enable row level security;

create policy "Users can view their own exercise settings." 
  on user_exercise_settings for select using (auth.uid() = user_id);
create policy "Users can insert their own exercise settings." 
  on user_exercise_settings for insert with check (auth.uid() = user_id);
create policy "Users can update their own exercise settings." 
  on user_exercise_settings for update using (auth.uid() = user_id);

-- 5. Weight Logs Table
create table public.weight_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  weight_kg numeric not null,
  log_date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.weight_logs enable row level security;

create policy "Users can view their own weight logs." 
  on weight_logs for select using (auth.uid() = user_id);
create policy "Users can insert their own weight logs." 
  on weight_logs for insert with check (auth.uid() = user_id);
create policy "Users can update their own weight logs." 
  on weight_logs for update using (auth.uid() = user_id);
create policy "Users can delete their own weight logs." 
  on weight_logs for delete using (auth.uid() = user_id);


-- 6. Storage Bucket for Exercise Images
-- Husk at oprette en bucket der hedder 'exercises' i Supabase Storage
-- og sætte den til 'Public'.
insert into storage.buckets (id, name, public) values ('exercises', 'exercises', true);

create policy "Exercise images are publicly accessible." 
  on storage.objects for select using (bucket_id = 'exercises');
create policy "Authenticated users can upload exercise images" 
  on storage.objects for insert to authenticated with check (bucket_id = 'exercises');
