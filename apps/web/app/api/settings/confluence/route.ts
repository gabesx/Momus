import {
  getConfluenceSettings,
  parseConfluenceBody,
  saveConfluenceSettings,
  toPublicConfluenceSettings,
} from '@momus/infra';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const settings = await getConfluenceSettings();
    return jsonOk({ confluence: toPublicConfluenceSettings(settings) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load Confluence settings';
    return jsonFail(message, 500);
  }
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const next = parseConfluenceBody(body);
    await saveConfluenceSettings(next);
    return jsonOk({
      message: 'Confluence settings saved successfully!',
      confluence: toPublicConfluenceSettings(next),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save Confluence settings';
    const status = /required|valid|Enter at least/i.test(message) ? 422 : 500;
    return jsonFail(message, status);
  }
}
