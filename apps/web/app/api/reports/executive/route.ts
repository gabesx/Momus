import { computeExecutiveSummary, computeProductHealth, listProductsByRisk } from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient, getJiraSettings } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import {
  getBugBudgetCacheVersion,
  getCachedAnalytics,
  setCachedAnalytics,
} from '@/lib/analytics-cache';
import { jsonFail, jsonOk } from '@/lib/sync-params';

// Namespaced so it never collides with /api/analytics (empty-param) cache keys.
const CACHE_KEY = 'report:executive';

export async function GET() {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const db = createServerClient();
    const version = await getBugBudgetCacheVersion(db);
    const cached = getCachedAnalytics(CACHE_KEY, version);
    if (cached) return jsonOk(cached as Record<string, unknown>);

    const nowIso = new Date().toISOString();
    const repo = new BugBudgetQueryRepository(db);
    const all = await repo.listAllForFilters();
    const summary = computeExecutiveSummary(all, nowIso);
    const products = listProductsByRisk(all).map((p) => computeProductHealth(all, p, nowIso));

    let jira_browse_base = '';
    try {
      const jira = await getJiraSettings();
      jira_browse_base = jira.url ? `${jira.url.replace(/\/$/, '')}/browse` : '';
    } catch {
      jira_browse_base = '';
    }

    const last_updated =
      all
        .map((r) => r.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const payload = {
      summary,
      products,
      meta: { last_updated, generated_at: nowIso, jira_browse_base },
    };
    setCachedAnalytics(CACHE_KEY, version, payload);
    return jsonOk(payload);
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load executive report', 500);
  }
}
