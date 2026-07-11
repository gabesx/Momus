import { JiraClient, getJiraSettings, parseJiraConnectionBody } from '@momus/infra';
import { MESSAGES } from '@momus/shared';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const stored = await getJiraSettings();
    const creds = parseJiraConnectionBody(body, stored);

    const client = new JiraClient({
      baseUrl: creds.url,
      email: creds.username,
      apiToken: creds.apiToken,
    });
    const user = await client.testConnection();
    return jsonOk({
      message: MESSAGES.M07,
      user: user.displayName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : MESSAGES.M08;
    const status = /required|valid/i.test(message) ? 422 : 400;
    return jsonFail(message, status);
  }
}
