import { NextResponse } from 'next/server';
import { createServerClient } from '@momus/infra/supabase';

export async function GET() {
  const checks: Record<string, string> = {
    app: 'ok',
    database: 'unknown',
  };

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from('settings').select('key').limit(1);
    checks.database = error ? `error: ${error.message}` : 'ok';
  } catch (err) {
    checks.database = err instanceof Error ? err.message : 'unavailable';
  }

  const healthy = checks.database === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      service: 'momus',
      version: '0.0.0',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
