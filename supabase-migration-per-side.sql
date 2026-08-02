-- Migration: øvelser der trænes én side ad gangen (fx side-planke, udfald)
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
-- Under træning køres to timere: højre side først, derefter venstre — så er sættet slut.

alter table public.exercises
  add column if not exists per_side boolean default false;
