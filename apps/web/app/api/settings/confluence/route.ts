import {
  getConfluenceSettings,
  parseConfluenceBody,
  saveConfluenceSettings,
  toPublicConfluenceSettings,
} from '@momus/infra';
import { writeSettingsAudit } from '@/lib/audit';
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
    const before = toPublicConfluenceSettings(await getConfluenceSettings());
    const next = parseConfluenceBody(body);
    await saveConfluenceSettings(next);
    const after = toPublicConfluenceSettings(next);
    await writeSettingsAudit({
      userId: auth.user.id,
      action: 'update',
      entityType: 'settings',
      entityKey: 'confluence',
      beforeValue: before as unknown as Record<string, unknown>,
      afterValue: after as unknown as Record<string, unknown>,
    });
    return jsonOk({
      message: 'Confluence settings saved successfully!',
      confluence: after,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save Confluence settings';
    const status = /required|valid|Enter at least/i.test(message) ? 422 : 500;
    return jsonFail(message, status);
  }
}
