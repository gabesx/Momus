import { SyncRunRepository, createServerClient } from '@momus/infra';
import { requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const db = createServerClient();
    const runs = await new SyncRunRepository(db).listRecent(7, 50);
    return jsonOk({
      activities: runs.map((r) => ({
        id: r.id,
        status: r.status,
        processed: r.processed,
        result: r.result,
        error_message: r.error_message,
        started_at: r.started_at,
        completed_at: r.completed_at,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load sync activity';
    return jsonFail(message, 500);
  }
}
