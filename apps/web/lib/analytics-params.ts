import type { AnalyticsFilterParams, AnalyticsTrendGrain } from '@momus/domain';

export function analyticsParamsFromUrl(url: URL): AnalyticsFilterParams {
  const sp = url.searchParams;
  const grain = sp.get('trend_grain') as AnalyticsTrendGrain | null;
  return {
    year: sp.get('year') || undefined,
    project: sp.get('project') || undefined,
    issue_type: (sp.get('issue_type') as AnalyticsFilterParams['issue_type']) || undefined,
    status: (sp.get('status') as AnalyticsFilterParams['status']) || undefined,
    severity: sp.get('severity') || undefined,
    ac_related: (sp.get('ac_related') as AnalyticsFilterParams['ac_related']) || undefined,
    priority: sp.get('priority') || undefined,
    date_from: sp.get('date_from') || undefined,
    date_to: sp.get('date_to') || undefined,
    trend_grain: grain || 'month',
    quarter: sp.get('quarter') || undefined,
  };
}

export function analyticsParamsToQuery(state: AnalyticsFilterParams): string {
  const sp = new URLSearchParams();
  if (state.year) sp.set('year', String(state.year));
  if (state.project) sp.set('project', state.project);
  if (state.issue_type) sp.set('issue_type', state.issue_type);
  if (state.status) sp.set('status', state.status);
  if (state.severity) sp.set('severity', state.severity);
  if (state.ac_related) sp.set('ac_related', state.ac_related);
  if (state.priority) sp.set('priority', state.priority);
  if (state.date_from) sp.set('date_from', state.date_from);
  if (state.date_to) sp.set('date_to', state.date_to);
  if (state.trend_grain && state.trend_grain !== 'month') {
    sp.set('trend_grain', state.trend_grain);
  }
  if (state.quarter) sp.set('quarter', String(state.quarter));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
