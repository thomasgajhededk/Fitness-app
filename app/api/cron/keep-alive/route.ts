import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Denne route holder Supabase-databasen "vågen" så free-tier-projektet
// ikke pauses efter 7 dages inaktivitet. Vercel Cron kalder den dagligt.

export async function GET(request: Request) {
  // Beskyt endpointet: kun kald med korrekt CRON_SECRET tillades.
  // Vercel Cron sender automatisk headeren "Authorization: Bearer <CRON_SECRET>".
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Brug service_role-nøglen så vi kan skrive til keep_alive-tabellen
  // uden at være påvirket af RLS. Denne nøgle må ALDRIG eksponeres i frontend.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  // 1. Skriv en ny ping (garanteret database-aktivitet)
  const { error: insertError } = await supabase
    .from('keep_alive')
    .insert({ pinged_at: now });

  if (insertError) {
    return NextResponse.json(
      { success: false, error: insertError.message },
      { status: 500 }
    );
  }

  // 2. Ryd op: slet rækker ældre end 7 dage, så tabellen aldrig vokser
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('keep_alive').delete().lt('pinged_at', sevenDaysAgo);

  return NextResponse.json({
    success: true,
    message: 'Database is awake!',
    pinged_at: now,
  });
}
