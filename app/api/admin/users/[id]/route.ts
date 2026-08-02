import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { password } = await request.json();
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Adgangskoden skal være mindst 8 tegn' }, { status: 400 });
  }

  const { error } = await serviceClient().auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  if (id === guard.userId) {
    return NextResponse.json({ error: 'Du kan ikke slette din egen bruger' }, { status: 400 });
  }

  // Alle bruger-tabeller har on delete cascade, så data følger med.
  const { error } = await serviceClient().auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
