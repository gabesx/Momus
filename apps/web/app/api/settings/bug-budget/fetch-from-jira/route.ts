import {
  JiraClient,
  assertJiraEnabled,
  getJiraSettings,
} from '@momus/infra';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk, resolveSyncParams } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const params = resolveSyncParams(body);
    if (typeof params === 'string') return jsonFail(params, 422);

    const settings = await getJiraSettings();
    assertJiraEnabled(settings);
    const client = new JiraClient({
      baseUrl: settings.url,
      email: settings.username,
      apiToken: settings.apiToken,
    });

    const previewCap = 100;
    const page = await client.searchPage({
      jql: params.jql,
      maxResults: Math.min(params.batchSize, previewCap),
    });
    const issues = page.issues.slice(0, previewCap);
    const estimatedBatches =
      params.maxTotalIssues > 0
        ? Math.ceil(Math.min(params.maxTotalIssues, previewCap) / Math.min(params.batchSize, 100))
        : Math.ceil(issues.length / Math.min(params.batchSize, 100)) || 1;

    return jsonOk({
      message: `Preview: ${issues.length} issue(s)`,
      data: {
        issues,
        total_found: issues.length,
        jql_used: params.jql,
        sync_settings: {
          sync_type: params.syncType,
          batch_size: params.batchSize,
          max_total_issues: params.maxTotalIssues,
          estimated_batches: estimatedBatches,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch from Jira';
    const status = message.includes('disabled') || message.includes('incomplete') ? 422 : 500;
    return jsonFail(message, status);
  }
}
