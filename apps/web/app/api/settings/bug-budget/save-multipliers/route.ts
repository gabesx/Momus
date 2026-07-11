import { BugBudgetConfigRepository, createServerClient, parseMultipliers } from '@momus/infra';
import { MESSAGES } from '@momus/shared';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = parseMultipliers(body);
    const db = createServerClient();
    await new BugBudgetConfigRepository(db).saveMultipliers(payload);
    return jsonOk({ message: MESSAGES.M14 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid multipliers';
    return jsonFail(message, 422);
  }
}
