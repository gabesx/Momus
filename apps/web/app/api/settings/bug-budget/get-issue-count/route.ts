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
    const count = await client.approximateCount(params.jql);
    return jsonOk({
      count,
      message: `Approximate count: ${count}`,
      jql_used: params.jql,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to count issues';
    const status = message.includes('disabled') || message.includes('incomplete') ? 422 : 500;
    return jsonFail(message, status);
  }
}
