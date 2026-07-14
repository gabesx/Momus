import { ROSTER_DISCIPLINES, RosterRepository, createServerClient } from '@momus/infra';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';
import { clearAnalyticsCache } from '@/lib/analytics-cache';

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

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;
  try {
    return jsonOk({ members: await new RosterRepository(createServerClient()).list() });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load roster', 500);
  }
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const member = await new RosterRepository(createServerClient()).create(parseMember(body));
    clearAnalyticsCache();
    return jsonOk({ member });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add roster member';
    return jsonFail(message, /required|valid|choose/i.test(message) ? 422 : 500);
  }
}
