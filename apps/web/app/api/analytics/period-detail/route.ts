import {
  applyAnalyticsFilters,
  computePeriodDetail,
  type AnalyticsTrendGrain,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period');
    const grain = (url.searchParams.get('grain') as AnalyticsTrendGrain | null) ?? 'month';
    if (!period) return jsonFail('period is required', 422);
    if (!['month', 'quarter', 'year'].includes(grain)) {
      return jsonFail('grain must be month|quarter|year', 422);
    }

    const params = analyticsParamsFromUrl(url);
    const nowIso = new Date().toISOString();
    const repo = new BugBudgetQueryRepository(createServerClient());
    const all = await repo.listAllForFilters();
    const filtered = applyAnalyticsFilters(all, { ...params, trend_grain: grain }, nowIso);
    const detail = computePeriodDetail(filtered, period, grain);
    return jsonOk({ detail });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load period detail', 500);
  }
}
