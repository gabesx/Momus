import { SyncRunRepository, createServerClient } from '@momus/infra';
import { requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const syncRunId = Number(id);
  if (!Number.isInteger(syncRunId) || syncRunId <= 0) {
    return jsonFail('Invalid sync run id', 404);
  }

  const db = createServerClient();
  const runs = new SyncRunRepository(db);
  const run = await runs.getById(syncRunId);
  if (!run) return jsonFail('Sync run not found', 404);

  // BB-PERM-02: only owner (or manage_users) may read status
  if (
    run.requested_by !== auth.user.id &&
    !auth.user.permissions.includes('manage_users')
  ) {
    return jsonFail('Forbidden', 403);
  }

  return jsonOk({
    data: {
      sync_run_id: run.id,
      status: run.status,
      percentage: run.percentage,
      processed: run.processed,
      total_issues: run.total_issues,
      current_batch: run.current_batch,
      result: run.result,
      error_message: run.error_message,
      started_at: run.started_at,
      completed_at: run.completed_at,
    },
  });
}
