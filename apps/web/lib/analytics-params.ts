import type { AnalyticsFilterParams } from '@momus/domain';

export function analyticsParamsFromUrl(url: URL): AnalyticsFilterParams {
  const sp = url.searchParams;
  return {
    year: sp.get('year') || undefined,
    project: sp.get('project') || undefined,
    issue_type: (sp.get('issue_type') as AnalyticsFilterParams['issue_type']) || undefined,
    status: (sp.get('status') as AnalyticsFilterParams['status']) || undefined,
  };
}
