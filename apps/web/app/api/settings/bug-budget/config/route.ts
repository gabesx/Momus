import { createServerClient, loadSettingsConfig } from '@momus/infra';
import { requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const db = createServerClient();
    const config = await loadSettingsConfig(db);
    return jsonOk({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load config';
    return jsonFail(message, 500);
  }
}
