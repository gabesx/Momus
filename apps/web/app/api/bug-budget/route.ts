import {
  BugBudgetQueryRepository,
  createServerClient,
  getJiraSettings,
} from '@momus/infra';
import { computeStats } from '@momus/domain';
import { MESSAGES } from '@momus/shared';
import { requireViewAnalytics } from '@/lib/auth';
import { bugBudgetParamsFromUrl } from '@/lib/bug-budget-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

/** Dashboard JSON data: filtered rows + stats (BB-API-03/04). */
export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const params = bugBudgetParamsFromUrl(url);
    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);
    const { parsed, rows, total, pageRows } = await repo.findFiltered(params);
    const stats = computeStats(rows, new Date().toISOString());
    const databaseTotal = await repo.countAll();

    let jiraBrowseBase = '';
    try {
      const jira = await getJiraSettings();
      jiraBrowseBase = jira.url ? `${jira.url.replace(/\/$/, '')}/browse` : '';
    } catch {
      jiraBrowseBase = '';
    }

    const from = total === 0 ? 0 : (parsed.page - 1) * parsed.perPage + 1;
    const to = Math.min(parsed.page * parsed.perPage, total);

    return jsonOk({
      stats,
      issues: pageRows,
      pagination: {
        page: parsed.page,
        per_page: parsed.perPage,
        total,
        from,
        to,
        last_page: Math.max(1, Math.ceil(total / parsed.perPage)),
      },
      per_page_capped: parsed.perPageCapped,
      notice: parsed.perPageCapped ? MESSAGES.M03 : null,
      jira_browse_base: jiraBrowseBase,
      active_filter_count: parsed.predicates.length,
      database_total: databaseTotal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load bug budget data';
    return jsonFail(message, 500);
  }
}
