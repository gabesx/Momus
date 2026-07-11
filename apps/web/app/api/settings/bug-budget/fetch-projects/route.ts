import {
  BugBudgetConfigRepository,
  JiraClient,
  assertJiraEnabled,
  createServerClient,
  getJiraSettings,
  mergeProjectSources,
} from '@momus/infra';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const settings = await getJiraSettings();
    assertJiraEnabled(settings);

    const client = new JiraClient({
      baseUrl: settings.url,
      email: settings.username,
      apiToken: settings.apiToken,
    });

    const [fromJira, fromDb] = await Promise.all([
      client.listProjects(),
      new BugBudgetConfigRepository(createServerClient()).listDistinctProjects(),
    ]);

    const projects = mergeProjectSources(fromJira, fromDb);
    return jsonOk({
      message: `Fetched ${projects.length} project${projects.length === 1 ? '' : 's'}`,
      projects,
      jira_count: fromJira.length,
      db_count: fromDb.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch projects';
    const status = /disabled|incomplete|required/i.test(message) ? 422 : 400;
    return jsonFail(message, status);
  }
}
