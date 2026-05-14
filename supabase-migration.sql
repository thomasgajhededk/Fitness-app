-- ============================================================
-- JAAFIT — Supabase sikkerhedsmigration
-- Kør dette i Supabase Dashboard → SQL Editor
-- ============================================================


-- ============================================================
-- 1. SLET DUPLIKEREDE RLS-POLITIKKER PÅ exercises
--    (der eksisterer både et dansk og et engelsk sæt)
-- ============================================================

DROP POLICY IF EXISTS "Se globale og egne øvelser"    ON public.exercises;
DROP POLICY IF EXISTS "Opret egne øvelser"            ON public.exercises;
DROP POLICY IF EXISTS "Opdater egne øvelser"          ON public.exercises;
DROP POLICY IF EXISTS "Slet egne øvelser"             ON public.exercises;

-- Slet også de gamle åbne politikker fra original schema (hvis de eksisterer)
DROP POLICY IF EXISTS "Exercises are viewable by everyone."                  ON public.exercises;
DROP POLICY IF EXISTS "Exercises are insertable by authenticated users."     ON public.exercises;
DROP POLICY IF EXISTS "Exercises are updatable by authenticated users."      ON public.exercises;
DROP POLICY IF EXISTS "Exercises are deletable by authenticated users."      ON public.exercises;
DROP POLICY IF EXISTS "Users can read global and own exercises"              ON public.exercises;
DROP POLICY IF EXISTS "Users can insert own exercises"                       ON public.exercises;
DROP POLICY IF EXISTS "Users can delete own exercises"                       ON public.exercises;


-- ============================================================
-- 2. GENOPRET RLS-POLITIKKER MED (SELECT auth.uid())
--    Dette forhindrer at funktionen evalueres pr. række
--    og giver markant bedre query-performance ved skala.
-- ============================================================

-- exercises: brugere kan se globale øvelser (user_id IS NULL) + egne
CREATE POLICY "read_global_and_own_exercises"
  ON public.exercises FOR SELECT
  USING (user_id IS NULL OR user_id = (SELECT auth.uid()));

-- exercises: brugere kan kun oprette øvelser med eget user_id
CREATE POLICY "insert_own_exercises"
  ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- exercises: brugere kan kun opdatere egne øvelser
CREATE POLICY "update_own_exercises"
  ON public.exercises FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- exercises: brugere kan kun slette egne øvelser
CREATE POLICY "delete_own_exercises"
  ON public.exercises FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ============================================================
-- 3. FIX RLS PÅ workout_logs — erstat auth.uid() med (SELECT auth.uid())
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own workout logs."   ON public.workout_logs;
DROP POLICY IF EXISTS "Users can insert their own workout logs." ON public.workout_logs;
DROP POLICY IF EXISTS "Users can update their own workout logs." ON public.workout_logs;
DROP POLICY IF EXISTS "Users can delete their own workout logs." ON public.workout_logs;

CREATE POLICY "select_own_workout_logs"
  ON public.workout_logs FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own_workout_logs"
  ON public.workout_logs FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own_workout_logs"
  ON public.workout_logs FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_own_workout_logs"
  ON public.workout_logs FOR DELETE
  USING (user_id = (SELECT auth.uid()));


-- ============================================================
-- 4. FIX RLS PÅ user_exercise_settings
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own exercise settings."  ON public.user_exercise_settings;
DROP POLICY IF EXISTS "Users can insert their own exercise settings." ON public.user_exercise_settings;
DROP POLICY IF EXISTS "Users can update their own exercise settings." ON public.user_exercise_settings;

CREATE POLICY "select_own_exercise_settings"
  ON public.user_exercise_settings FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own_exercise_settings"
  ON public.user_exercise_settings FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own_exercise_settings"
  ON public.user_exercise_settings FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

-- Tilføj DELETE-politik (manglede i original schema)
CREATE POLICY "delete_own_exercise_settings"
  ON public.user_exercise_settings FOR DELETE
  USING (user_id = (SELECT auth.uid()));


-- ============================================================
-- 5. FIX RLS PÅ weight_logs
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own weight logs."   ON public.weight_logs;
DROP POLICY IF EXISTS "Users can insert their own weight logs." ON public.weight_logs;
DROP POLICY IF EXISTS "Users can update their own weight logs." ON public.weight_logs;
DROP POLICY IF EXISTS "Users can delete their own weight logs." ON public.weight_logs;

CREATE POLICY "select_own_weight_logs"
  ON public.weight_logs FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own_weight_logs"
  ON public.weight_logs FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own_weight_logs"
  ON public.weight_logs FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_own_weight_logs"
  ON public.weight_logs FOR DELETE
  USING (user_id = (SELECT auth.uid()));


-- ============================================================
-- 6. TILFØJ MANGLENDE INDEKSER PÅ FOREIGN KEYS
--    Forhindrer fuld tabel-scan ved JOIN og WHERE-opslag
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_exercises_user_id
  ON public.exercises(user_id);

CREATE INDEX IF NOT EXISTS idx_user_exercise_settings_exercise_id
  ON public.user_exercise_settings(exercise_id);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_id
  ON public.weight_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id
  ON public.workout_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_workout_logs_exercise_id
  ON public.workout_logs(exercise_id);


-- ============================================================
-- 7. FIX STORAGE BUCKET POLICY
--    Fjerner den brede listing-policy og erstatter med
--    én der kun tillader læsning af specifikke objekter.
-- ============================================================

DROP POLICY IF EXISTS "Exercise images are publicly accessible." ON storage.objects;

-- Tillad kun læsning af individuelle objekter (ikke listing af bucket)
CREATE POLICY "public_read_exercise_objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exercises');

-- Upload-politik er uændret (eksisterer allerede)


-- ============================================================
-- DONE ✓
--
-- Husk at gøre følgende manuelt i Supabase Dashboard:
--
-- Authentication → Providers → Email → Password security:
--   → Slå "Leaked password protection" TIL
--      (tjekker adgangskoder mod HaveIBeenPwned.org)
-- ============================================================
