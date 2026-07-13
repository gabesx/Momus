import {
  analyticsCsvFilename,
  applyAnalyticsFilters,
  buildAnalyticsCsv,
  computeAnalyticsSummary,
  computeTrends,
  type AnalyticsTrendGrain,
} from '@momus/domain';
import {
  BugBudgetQueryRepository,
  createServerClient,
  loadAnalyticsSettings,
  loadSummaryConfig,
} from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { jsonFail } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const params = analyticsParamsFromUrl(new URL(request.url));
    const grain: AnalyticsTrendGrain = params.trend_grain ?? 'month';
    const nowIso = new Date().toISOString();
    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);
    const [all, config, settings] = await Promise.all([
      repo.listAllForFilters(),
      loadSummaryConfig(db),
      loadAnalyticsSettings(db),
    ]);
    const filtered = applyAnalyticsFilters(all, params, nowIso);
    const summary = computeAnalyticsSummary(filtered, nowIso, {
      sla: settings,
      prod_labels: settings.prod_labels,
    });
    const trends = computeTrends(filtered, grain, nowIso, config.multipliers);
    const csv = buildAnalyticsCsv(summary, trends, nowIso);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${analyticsCsvFilename(nowIso)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to export analytics CSV', 500);
  }
}
