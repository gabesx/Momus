import {
  BugBudgetQueryRepository,
  createServerClient,
  getJiraSettings,
} from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

type RouteContext = { params: Promise<{ id: string }> };

/** Detail by numeric id or jira_key (BB-API-02). */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);

    let issue: Record<string, unknown> | null = null;
    if (/^\d+$/.test(id)) {
      const row = await repo.getById(Number(id));
      if (row) {
        issue = await repo.getByJiraKey(row.jira_key);
      }
    } else {
      issue = await repo.getByJiraKey(id);
    }

    if (!issue) return jsonFail('Not found', 404);

    let jiraBrowseBase = '';
    try {
      const jira = await getJiraSettings();
      jiraBrowseBase = jira.url ? `${jira.url.replace(/\/$/, '')}/browse` : '';
    } catch {
      jiraBrowseBase = '';
    }

    return jsonOk({
      issue,
      jira_browse_url: jiraBrowseBase ? `${jiraBrowseBase}/${issue.jira_key}` : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load issue';
    return jsonFail(message, 500);
  }
}
