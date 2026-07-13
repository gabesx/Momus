import {
  applyAnalyticsFilters,
  computeAnalyticsSummary,
  computeTrends,
  extractFilterOptions,
  type AnalyticsTrendGrain,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient, loadSummaryConfig } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const params = analyticsParamsFromUrl(new URL(request.url));
    const grain: AnalyticsTrendGrain = params.trend_grain ?? 'month';
    const nowIso = new Date().toISOString();
    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);
    const [all, config] = await Promise.all([repo.listAllForFilters(), loadSummaryConfig(db)]);
    const opts = extractFilterOptions(all);
    const filter_options = {
      projects: opts.projects,
      years: opts.years,
    };
    const filtered = applyAnalyticsFilters(all, params, nowIso);
    const summary = computeAnalyticsSummary(filtered, nowIso);
    const trends = computeTrends(filtered, grain, nowIso, config.multipliers);
    const last_updated =
      all
        .map((r) => r.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    const scope_hint =
      params.year && params.year !== 'all'
        ? `Showing data for year ${params.year}`
        : params.date_from || params.date_to
          ? 'Showing data for selected date range'
          : 'Showing all years';
    return jsonOk({
      summary,
      trends,
      filter_options,
      meta: { last_updated, scope_hint, trend_grain: grain },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load analytics', 500);
  }
}
