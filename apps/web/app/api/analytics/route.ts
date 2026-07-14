import {
  applyAnalyticsFilters,
  computeAnalyticsSummary,
  computeTrends,
  extractFilterOptions,
  buildQaSlipRows,
  type AnalyticsTrendGrain,
} from '@momus/domain';
import {
  BugBudgetQueryRepository,
  createServerClient,
  loadAnalyticsSettings,
  loadSummaryConfig,
  RosterRepository,
} from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import {
  getBugBudgetCacheVersion,
  getCachedAnalytics,
  setCachedAnalytics,
} from '@/lib/analytics-cache';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

function cacheKeyFromUrl(url: URL): string {
  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const url = new URL(request.url);
    const params = analyticsParamsFromUrl(url);
    const grain: AnalyticsTrendGrain = params.trend_grain ?? 'month';
    const db = createServerClient();

    const cacheKey = cacheKeyFromUrl(url);
    const version = await getBugBudgetCacheVersion(db);
    const cached = getCachedAnalytics(cacheKey, version);
    if (cached) return jsonOk(cached as Record<string, unknown>);

    const nowIso = new Date().toISOString();
    const repo = new BugBudgetQueryRepository(db);
    const [all, config, settings, roster] = await Promise.all([
      repo.listAllForFilters(),
      loadSummaryConfig(db),
      loadAnalyticsSettings(db),
      new RosterRepository(db).list(),
    ]);
    const opts = extractFilterOptions(all);
    const filter_options = {
      projects: opts.projects,
      years: opts.years,
    };
    const filtered = applyAnalyticsFilters(all, params, nowIso);
    const summary = computeAnalyticsSummary(filtered, nowIso, {
      sla: settings,
      prod_labels: settings.prod_labels,
    });
    const trends = computeTrends(filtered, grain, nowIso, config.multipliers);
    const qa_slip = buildQaSlipRows(roster, filtered);
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
    const payload = {
      summary,
      trends,
      qa_slip,
      filter_options,
      meta: { last_updated, scope_hint, trend_grain: grain },
    };
    setCachedAnalytics(cacheKey, version, payload);
    return jsonOk(payload);
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load analytics', 500);
  }
}
