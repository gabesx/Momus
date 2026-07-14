import { ROSTER_DISCIPLINES, RosterRepository, createServerClient } from '@momus/infra';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';
import { clearAnalyticsCache } from '@/lib/analytics-cache';

function memberId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid roster member');
  return id;
}
function parseMember(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const discipline = typeof body.discipline === 'string' ? body.discipline : '';
  if (!name) throw new Error('Name is required');
  if (!(ROSTER_DISCIPLINES as readonly string[]).includes(discipline))
    throw new Error('Choose a valid discipline');
  const optional = (key: 'jira_account_id' | 'tribe' | 'squad') => {
    const value = body[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  return {
    name,
    discipline: discipline as (typeof ROSTER_DISCIPLINES)[number],
    jira_account_id: optional('jira_account_id'),
    tribe: optional('tribe'),
    squad: optional('squad'),
  };
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const member = await new RosterRepository(createServerClient()).update(
      memberId(id),
      parseMember(body),
    );
    clearAnalyticsCache();
    return jsonOk({ member });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save roster member';
    return jsonFail(message, /invalid|required|valid|choose/i.test(message) ? 422 : 500);
  }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;
  try {
    const { id } = await params;
    await new RosterRepository(createServerClient()).remove(memberId(id));
    clearAnalyticsCache();
    return jsonOk({});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove roster member';
    return jsonFail(message, /invalid/i.test(message) ? 422 : 500);
  }
}
