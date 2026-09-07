-- Migration: løbeture med gennemsnitsfart + hvor langt man nåede i sidste AMRAP-runde
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
--
-- avg_speed_kmh           gennemsnitsfart i km/t på en gåtur eller løbetur.
-- amrap_partial_exercise  navnet på den øvelse man var nået til i den runde der ikke blev færdig.
-- amrap_partial_index     øvelsens plads i runden (1-baseret), så man kan vise "øvelse 2 af 5".
--
-- Løbeture gemmes som workout_type = 'run'. Gåture bliver ved med at være 'walk'.

alter table public.workout_sessions
  add column if not exists avg_speed_kmh          numeric,
  add column if not exists amrap_partial_exercise text,
  add column if not exists amrap_partial_index    integer;
