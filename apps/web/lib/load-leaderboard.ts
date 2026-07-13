import {
  availableYears,
  computeLeaderboard,
  defaultPeriodForType,
  resolvePeriodRange,
  type DateRange,
  type LeaderboardFilterParams,
  type LeaderboardIssueRow,
  type LeaderboardResult,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { mapBugBudgetToLeaderboardRow } from '@/lib/leaderboard-map';

export type LeaderboardFilterOptions = {
  years: number[];
  period_types: { value: string; label: string }[];
};

export type LeaderboardPayload = LeaderboardResult & {
  filter_options: LeaderboardFilterOptions;
};

const PERIOD_TYPES: LeaderboardFilterOptions['period_types'] = [
  { value: 'all', label: 'All Time' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'semester', label: 'Semester' },
  { value: 'quarterly', label: 'Quarterly' },
];

/** Resolve SQL date window for leaderboard queries (null = all time). */
export function leaderboardSqlRange(
  params: LeaderboardFilterParams,
  nowIso: string,
): DateRange | null {
  const period_type = params.period_type ?? 'quarterly';
  const year = Number(params.year) || new Date(nowIso).getUTCFullYear();
  const period = params.period?.trim() || defaultPeriodForType(period_type, nowIso);
  return resolvePeriodRange(year, period_type, period);
}

export async function loadLeaderboard(
  params: LeaderboardFilterParams,
  nowIso = new Date().toISOString(),
): Promise<{ data: LeaderboardPayload } | { error: Response }> {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return { error: auth.error };

  const range = leaderboardSqlRange(params, nowIso);
  const repo = new BugBudgetQueryRepository(createServerClient());
  const all = await repo.listForLeaderboard(range);
  const rows: LeaderboardIssueRow[] = all.map(mapBugBudgetToLeaderboardRow);
  const board = computeLeaderboard(rows, params, nowIso);

  return {
    data: {
      ...board,
      filter_options: {
        years: availableYears(nowIso),
        period_types: PERIOD_TYPES,
      },
    },
  };
}
