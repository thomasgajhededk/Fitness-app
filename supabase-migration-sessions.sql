-- Migration: gem antal øvelser + forbrændte kalorier pr. træning
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
-- Begge kolonner er nullable → eksisterende sessioner beholder null.

alter table public.workout_sessions
  add column if not exists exercise_count integer,
  add column if not exists calories_burned integer;
