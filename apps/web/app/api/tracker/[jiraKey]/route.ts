import { parseTrackerPatch } from '@momus/domain';
import { TrackerRepository, createServerClient } from '@momus/infra';
import { assertCsrf, requireViewAnalytics } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

type RouteContext = { params: Promise<{ jiraKey: string }> };

/** Patch Momus-owned tracker fields for one issue. */
export async function PATCH(request: Request, context: RouteContext) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const { jiraKey } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseTrackerPatch(body);
    if (!parsed.ok) return jsonFail(parsed.message, 422);

    const repo = new TrackerRepository(createServerClient());
    const row = await repo.patchFields(jiraKey, parsed.value, {
      at: new Date().toISOString(),
      by: String(auth.user.id),
    });

    return jsonOk({ row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update tracker issue';
    if (message.includes('not found')) return jsonFail('Not found', 404);
    return jsonFail(message, 500);
  }
}
