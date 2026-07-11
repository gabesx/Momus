import {
  applyAnalyticsFilters,
  computeAnalyticsSummary,
  computeMonthlyTrends,
  extractFilterOptions,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const params = analyticsParamsFromUrl(new URL(request.url));
    const nowIso = new Date().toISOString();
    const repo = new BugBudgetQueryRepository(createServerClient());
    const all = await repo.listAllForFilters();
    const opts = extractFilterOptions(all);
    const filter_options = {
      projects: opts.projects,
      years: opts.years,
    };
    const filtered = applyAnalyticsFilters(all, params, nowIso);
    const summary = computeAnalyticsSummary(filtered, nowIso);
    const trends = computeMonthlyTrends(filtered, nowIso);
    const last_updated =
      all
        .map((r) => r.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    const scope_hint =
      params.year && params.year !== 'all'
        ? `Showing data for year ${params.year}`
        : 'Showing recent bug/defect data (default last 24 months)';
    return jsonOk({
      summary,
      trends,
      filter_options,
      meta: { last_updated, scope_hint },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load analytics', 500);
  }
}
