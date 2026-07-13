import {
  createServerClient,
  loadAnalyticsSettings,
  parseAnalyticsSettings,
  saveAnalyticsSettings,
} from '@momus/infra';
import { writeSettingsAudit } from '@/lib/audit';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;
  try {
    const settings = await loadAnalyticsSettings(createServerClient());
    return jsonOk({ settings });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load analytics settings', 500);
  }
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const settings = parseAnalyticsSettings(body);
    const db = createServerClient();
    const before = await loadAnalyticsSettings(db);
    await saveAnalyticsSettings(db, settings);
    await writeSettingsAudit({
      db,
      userId: auth.user.id,
      action: 'update',
      entityType: 'bug_budget_config',
      entityKey: 'analytics_settings',
      beforeValue: before,
      afterValue: settings,
    });
    return jsonOk({ settings, message: 'Analytics settings saved' });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Invalid analytics settings', 422);
  }
}
