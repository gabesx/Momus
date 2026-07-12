import type { LeaderboardFilterParams, LeaderboardPeriodType } from '@momus/domain';

export function leaderboardParamsFromUrl(url: URL): LeaderboardFilterParams {
  const sp = url.searchParams;
  const period_type = (sp.get('period_type') as LeaderboardPeriodType | null) || 'quarterly';
  return {
    period_type,
    year: sp.get('year') || undefined,
    period: sp.get('period') || undefined,
  };
}

export function leaderboardParamsToQuery(state: LeaderboardFilterParams): string {
  const sp = new URLSearchParams();
  if (state.period_type && state.period_type !== 'quarterly') {
    sp.set('period_type', state.period_type);
  } else if (state.period_type === 'quarterly') {
    sp.set('period_type', 'quarterly');
  }
  if (state.year) sp.set('year', String(state.year));
  if (state.period) sp.set('period', String(state.period));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
