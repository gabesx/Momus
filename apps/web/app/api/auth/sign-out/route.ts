import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
