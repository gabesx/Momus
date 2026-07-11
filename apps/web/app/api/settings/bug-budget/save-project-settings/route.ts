import { BugBudgetConfigRepository, createServerClient } from '@momus/infra';
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
    const budgetData =
      typeof body.budget_data === 'string'
        ? (JSON.parse(body.budget_data) as { projects?: string[]; amounts?: number[] })
        : (body.budget_data as { projects?: string[]; amounts?: number[] } | undefined);
    const mappingData =
      typeof body.mapping_data === 'string'
        ? (JSON.parse(body.mapping_data) as {
            jira_projects?: string[];
            display_names?: string[];
          })
        : (body.mapping_data as
            | { jira_projects?: string[]; display_names?: string[] }
            | undefined);

    if (!budgetData?.projects || !budgetData.amounts) {
      return jsonFail('budget_data.projects and amounts are required', 422);
    }
    if (!mappingData?.jira_projects || !mappingData.display_names) {
      return jsonFail('mapping_data.jira_projects and display_names are required', 422);
    }

    const db = createServerClient();
    const repo = new BugBudgetConfigRepository(db);
    const allProjects = await repo.listDistinctProjects();
    await repo.saveProjectSettings(
      {
        projects: budgetData.projects,
        amounts: budgetData.amounts.map(Number),
        jira_projects: mappingData.jira_projects,
        display_names: mappingData.display_names,
      },
      allProjects,
    );
    return jsonOk({ message: MESSAGES.M16 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save project settings';
    return jsonFail(message, 422);
  }
}
