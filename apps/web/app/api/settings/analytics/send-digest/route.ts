import { createServerClient, loadAnalyticsSettings, runAnalyticsDigest } from '@momus/infra';
import { writeSettingsAudit } from '@/lib/audit';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

/**
 * Manual "send digest now" — builds and posts the weekly digest immediately
 * using the saved analytics settings. Bypasses the schedule (explicit action)
 * but requires a configured webhook. Doubles as a webhook test.
 */
export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const db = createServerClient();
    const settings = await loadAnalyticsSettings(db);
    if (!settings.digest_webhook_url) {
      return jsonFail('Configure and save a webhook URL before sending.', 400);
    }

    const result = await runAnalyticsDigest(db, settings);

    await writeSettingsAudit({
      db,
      userId: auth.user.id,
      action: 'digest_test',
      entityType: 'bug_budget_config',
      entityKey: 'analytics_settings',
      beforeValue: null,
      afterValue: { provider: settings.digest_provider, messages: result.messages },
    });

    return jsonOk({ messages: result.messages, message: `Digest sent (${result.messages} messages)` });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to send digest', 502);
  }
}
