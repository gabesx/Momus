import {
  getJiraSettings,
  parseJiraConnectionBody,
  saveJiraSettings,
  toPublicJiraConnection,
} from '@momus/infra';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

/** GET current Jira connection (token masked). */
export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const settings = await getJiraSettings();
    return jsonOk({ connection: toPublicJiraConnection(settings) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load connection';
    return jsonFail(message, 500);
  }
}

/**
 * POST save Jira connection into public.settings.
 * Body: `{ site_url?, email?, api_token?, enabled? }` — masked token keeps stored value.
 */
export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const stored = await getJiraSettings();
    const next = parseJiraConnectionBody(body, stored);
    await saveJiraSettings(next);
    return jsonOk({
      message: 'Jira connection saved successfully!',
      connection: toPublicJiraConnection(next),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save connection';
    const status = /required|valid/i.test(message) ? 422 : 500;
    return jsonFail(message, status);
  }
}
