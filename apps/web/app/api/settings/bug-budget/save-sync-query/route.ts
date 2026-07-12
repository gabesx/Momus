import {
  BugBudgetConfigRepository,
  createServerClient,
  parseSyncQueryConfig,
} from '@momus/infra';
import { writeSettingsAudit } from '@/lib/audit';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = parseSyncQueryConfig(body);
    const db = createServerClient();
    const repo = new BugBudgetConfigRepository(db);
    const before = await repo.getSyncQuery();
    await repo.saveSyncQuery(payload);
    await writeSettingsAudit({
      db,
      userId: auth.user.id,
      action: 'update',
      entityType: 'bug_budget_config',
      entityKey: 'sync_query',
      beforeValue: before as unknown as Record<string, unknown>,
      afterValue: payload as unknown as Record<string, unknown>,
    });
    return jsonOk({
      message: 'JQL query configuration saved successfully!',
      sync_query: payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save sync query';
    return jsonFail(message, 422);
  }
}
