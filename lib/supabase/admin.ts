import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Service role-nøglen omgår al Row Level Security. Den må kun bruges i
// route handlers, aldrig sendes til browseren.
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mangler');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AdminGuard = { ok: true; userId: string } | { ok: false; status: number; error: string };

// Læser kalderens session fra cookies og slår rollen op med service role-klienten,
// så et manipuleret svar fra klienten ikke kan give adgang.
export async function requireAdmin(): Promise<AdminGuard> {
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Ikke logget ind' };

  const { data: profile } = await serviceClient()
    .from('profiles').select('is_admin').eq('id', user.id).single();

  if (!profile?.is_admin) return { ok: false, status: 403, error: 'Kræver administrator' };
  return { ok: true, userId: user.id };
}
