import { NextResponse } from 'next/server';
import {
  fetchLatestSyncRun,
  getInngestEnvFlags,
  isWorkerConfigured,
} from '@/lib/health';

export async function GET() {
  const flags = getInngestEnvFlags();
  const checks: Record<string, unknown> = { ...flags, database: 'unknown' };

  try {
    checks.latest_sync_run = await fetchLatestSyncRun();
    checks.database = 'ok';
  } catch (err) {
    checks.database = err instanceof Error ? err.message : 'unavailable';
    checks.latest_sync_run = null;
  }

  const dbOk = checks.database === 'ok';
  const workerOk = isWorkerConfigured(flags);
  const healthy = dbOk && workerOk;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      service: 'momus-worker',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
