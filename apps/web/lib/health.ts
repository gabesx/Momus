import { createServerClient } from '@momus/infra';

export type LatestSyncRunSnapshot = {
  id: number;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export function getInngestEnvFlags(): {
  inngest_event_key: boolean;
  inngest_signing_key: boolean;
  sync_inline_fallback: boolean;
} {
  return {
    inngest_event_key: Boolean(process.env.INNGEST_EVENT_KEY?.trim()),
    inngest_signing_key: Boolean(process.env.INNGEST_SIGNING_KEY?.trim()),
    sync_inline_fallback: process.env.SYNC_INLINE_AFTER_RESPONSE === 'true',
  };
}

/** True when sync can be enqueued or run inline. */
export function isWorkerConfigured(flags = getInngestEnvFlags()): boolean {
  return flags.inngest_event_key || flags.sync_inline_fallback;
}

export async function fetchLatestSyncRun(): Promise<LatestSyncRunSnapshot | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('bug_budget_sync_runs')
    .select('id, status, created_at, started_at, completed_at, error_message')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`latest sync run query failed: ${error.message}`);
  if (!data) return null;
  return {
    id: Number(data.id),
    status: String(data.status),
    created_at: String(data.created_at),
    started_at: (data.started_at as string | null) ?? null,
    completed_at: (data.completed_at as string | null) ?? null,
    error_message: (data.error_message as string | null) ?? null,
  };
}
