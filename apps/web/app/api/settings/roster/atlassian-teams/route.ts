import {
  assertJiraEnabled,
  createServerClient,
  getJiraSettings,
  JiraClient,
  loadAtlassianOrgId,
  ROSTER_DISCIPLINES,
  RosterRepository,
  saveAtlassianOrgId,
} from '@momus/infra';
import { clearAnalyticsCache } from '@/lib/analytics-cache';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

function clientFromSettings(settings: Awaited<ReturnType<typeof getJiraSettings>>) {
  assertJiraEnabled(settings);
  return new JiraClient({
    baseUrl: settings.url,
    email: settings.username,
    apiToken: settings.apiToken,
  });
}

/** Org id from the request when provided (and persist it), else the stored one. */
async function resolveOrgId(
  db: ReturnType<typeof createServerClient>,
  body: Record<string, unknown>,
): Promise<string> {
  const provided = typeof body.org_id === 'string' ? body.org_id.trim() : '';
  const stored = await loadAtlassianOrgId(db);
  if (provided && provided !== stored) await saveAtlassianOrgId(db, provided);
  return provided || stored;
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action;
    const settings = await getJiraSettings();
    const jira = clientFromSettings(settings);
    const db = createServerClient();
    const orgId = await resolveOrgId(db, body);

    if (action === 'load') {
      return jsonOk({ teams: await jira.listTeams(orgId || undefined), org_id: orgId });
    }

    const teamId = typeof body.team_id === 'string' ? body.team_id.trim() : '';
    const teamName = typeof body.team_name === 'string' ? body.team_name.trim() : '';
    const discipline = typeof body.discipline === 'string' ? body.discipline : '';
    if (action !== 'import' || !teamId || !teamName) throw new Error('Choose an Atlassian team');
    if (!(ROSTER_DISCIPLINES as readonly string[]).includes(discipline)) {
      throw new Error('Choose a valid discipline');
    }
    const members = await jira.listTeamMembers(teamId, orgId || undefined);
    const imported = await new RosterRepository(db).importTeamMembers(
      members.map((member) => ({ name: member.name, jira_account_id: member.accountId })),
      {
        discipline: discipline as (typeof ROSTER_DISCIPLINES)[number],
        tribe: typeof body.tribe === 'string' && body.tribe.trim() ? body.tribe.trim() : null,
        squad: typeof body.squad === 'string' && body.squad.trim() ? body.squad.trim() : teamName,
      },
    );
    clearAnalyticsCache();
    return jsonOk({ imported, message: `Imported ${imported} member${imported === 1 ? '' : 's'}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load Atlassian teams';
    return jsonFail(
      message,
      /disabled|incomplete|required|choose|valid|organization/i.test(message) ? 422 : 400,
    );
  }
}
