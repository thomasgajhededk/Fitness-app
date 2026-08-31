-- Migration: bland programmet automatisk hver uge
-- Kør i Supabase SQL-editoren. Sikker at køre flere gange (idempotent).
--
-- week_start      mandagen i den uge programmet blev lavet til. Er den ældre end
--                 denne uges mandag, blandes øvelserne på ny ved næste besøg.
-- include_cardio  om cardio var valgt til, så den ugentlige blanding rammer det samme.
-- auto_shuffle    slå den ugentlige blanding fra hvis man hellere vil beholde sit program.

alter table public.user_programs
  add column if not exists week_start     date,
  add column if not exists include_cardio boolean not null default false,
  add column if not exists auto_shuffle   boolean not null default true;
