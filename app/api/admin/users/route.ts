import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Bevidst: vi henter kun antal træninger, aldrig weight_logs.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = serviceClient();
  const [{ data: profiles }, { data: sessions }, { data: authUsers }] = await Promise.all([
    admin.from('profiles').select('id, display_name, is_admin, created_at').order('created_at'),
    admin.from('workout_sessions').select('user_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const counts = new Map<string, number>();
  for (const s of sessions ?? []) counts.set(s.user_id, (counts.get(s.user_id) ?? 0) + 1);
  const emails = new Map(authUsers.users.map(u => [u.id, u.email ?? '']));

  return NextResponse.json({
    users: (profiles ?? []).map(p => ({
      id: p.id,
      display_name: p.display_name,
      email: emails.get(p.id) ?? '',
      is_admin: p.is_admin,
      workout_count: counts.get(p.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { name, email, password } = await request.json();
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Navn, e-mail og adgangskode er påkrævet' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Adgangskoden skal være mindst 8 tegn' }, { status: 400 });
  }

  const { data, error } = await serviceClient().auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { display_name: name.trim() },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.user.id });
}
